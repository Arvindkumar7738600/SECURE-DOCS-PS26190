import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessCase, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction, DocumentType, Prisma, RoleName } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';
import { buildSearchSummary, rankCasesBySemanticRelevance, rankSearchDocuments } from '@/lib/search/search-service';
import { getEmbeddingStatus } from '@/lib/embeddings/semantic-search';

export const dynamic = 'force-dynamic';

const MAX_SEARCH_LIMIT = 20;

function parseLimit(value: string | null): number {
  const parsed = parseInt(value || '10', 10);
  if (Number.isNaN(parsed)) return 10;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, parsed));
}

function buildCaseWhere(query: string, caseId?: string): Prisma.CaseWhereInput {
  const conditions: Prisma.CaseWhereInput[] = [];

  if (caseId) {
    conditions.push({ id: caseId });
  }

  if (query) {
    conditions.push({
      OR: [
        { caseNumber: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { department: { contains: query, mode: 'insensitive' } },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

function buildDocumentWhere(query: string, caseId?: string, documentType?: DocumentType): Prisma.DocumentWhereInput {
  const conditions: Prisma.DocumentWhereInput[] = [];

  if (caseId) {
    conditions.push({ caseId });
  }

  if (documentType) {
    conditions.push({ documentType });
  }

  if (query) {
    conditions.push({
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { originalFilename: { contains: query, mode: 'insensitive' } },
        { metadata: { summary: { contains: query, mode: 'insensitive' } } },
        { chunks: { some: { content: { contains: query, mode: 'insensitive' } } } },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';

  const auth = await authorizeRequest(req, 'SEARCH');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim() || '';
    const scope = (searchParams.get('scope') || 'all').toLowerCase();
    const limit = parseLimit(searchParams.get('limit'));
    const caseId = searchParams.get('case_id') || undefined;
    const documentTypeParam = searchParams.get('document_type');
    const documentType = documentTypeParam && Object.values(DocumentType).includes(documentTypeParam as DocumentType)
      ? (documentTypeParam as DocumentType)
      : undefined;

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters long' },
        { status: 400, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const caseWhere = buildCaseWhere(query, caseId);
    const documentWhere = buildDocumentWhere(query, caseId, documentType);
    const isAdminOrAuditor = auth.user.roles.includes(RoleName.ADMIN) || auth.user.roles.includes(RoleName.AUDITOR);

    const [caseCandidates, documentCandidates] = await Promise.all([
      scope === 'documents'
        ? Promise.resolve([])
        : prisma.case.findMany({
            where: caseWhere,
            include: {
              creator: { select: { id: true, fullName: true, email: true, department: true } },
              _count: { select: { members: true, documents: true } },
            },
            orderBy: { updatedAt: 'desc' },
          }),
      scope === 'cases'
        ? Promise.resolve([])
        : prisma.document.findMany({
            where: documentWhere,
            include: {
              case: { select: { id: true, caseNumber: true, title: true } },
              uploader: { select: { id: true, fullName: true, email: true, department: true } },
              versions: {
                where: { versionNumber: 1 },
                select: { storageKey: true, sha256: true, createdAt: true },
              },
              metadata: { select: { summary: true } },
              chunks: { select: { content: true } },
              _count: { select: { chunks: true } },
            },
            orderBy: { updatedAt: 'desc' },
          }),
    ]);

    const visibleCases = isAdminOrAuditor
      ? caseCandidates
      : (await Promise.all(
          caseCandidates.map(async (candidate) => ({
            candidate,
            allowed: await canAccessCase(auth.user!.id, auth.user!.roles, candidate.id),
          }))
        ))
          .filter((item) => item.allowed)
          .map((item) => item.candidate);

    const visibleDocuments = isAdminOrAuditor
      ? documentCandidates
      : (await Promise.all(
          documentCandidates.map(async (candidate) => ({
            candidate,
            allowed: await canAccessDocument(auth.user!.id, auth.user!.roles, candidate.id),
          }))
        ))
          .filter((item) => item.allowed)
          .map((item) => item.candidate);

    const rankedCases = scope === 'documents'
      ? []
      : rankCasesBySemanticRelevance(query, visibleCases).slice(0, limit).map((item) => ({
          id: item.caseRecord.id,
          caseNumber: item.caseRecord.caseNumber,
          title: item.caseRecord.title,
          description: item.caseRecord.description,
          caseType: item.caseRecord.caseType,
          status: item.caseRecord.status,
          priority: item.caseRecord.priority,
          department: item.caseRecord.department,
          relevanceScore: Number(item.score.toFixed(3)),
          creator: item.caseRecord.creator,
          documentCount: item.caseRecord._count.documents,
          memberCount: item.caseRecord._count.members,
          summary: buildSearchSummary(item.caseRecord.description),
        }));

    const rankedDocuments = scope === 'cases'
      ? []
      : rankSearchDocuments(
          query,
          visibleDocuments.map((doc) => ({
            id: doc.id,
            title: doc.title,
            originalFilename: doc.originalFilename,
            summary: doc.metadata?.summary || null,
            chunks: doc.chunks,
          }))
        )
          .slice(0, limit)
          .map((item) => {
            const doc = visibleDocuments.find((candidate) => candidate.id === item.document.id)!;
            return {
              id: doc.id,
              caseId: doc.caseId,
              caseNumber: doc.case.caseNumber,
              caseTitle: doc.case.title,
              title: doc.title,
              originalFilename: doc.originalFilename,
              documentType: doc.documentType,
              status: doc.status,
              sha256: doc.versions[0]?.sha256 || 'N/A',
              embeddingStatus: getEmbeddingStatus({
                chunkCount: doc._count.chunks,
                documentStatus: doc.status,
              }),
              relevanceScore: Number(item.score.toFixed(3)),
              matchedChunks: item.matchedChunks,
              uploader: doc.uploader,
              summary: doc.metadata?.summary || null,
              storageKey: doc.versions[0]?.storageKey || 'N/A',
            };
          });

    await logAuditEvent({
      userId: auth.user.id,
      action: AuditAction.SEARCH,
      ipAddress,
      userAgent,
      requestId,
      metadata: {
        query,
        scope,
        caseId,
        documentType,
        caseResults: rankedCases.length,
        documentResults: rankedDocuments.length,
      },
    });

    return NextResponse.json(
      {
        query,
        scope,
        searchMode: 'HYBRID',
        cases: rankedCases,
        documents: rankedDocuments,
        counts: {
          cases: rankedCases.length,
          documents: rankedDocuments.length,
        },
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('Search API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error performing search' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
