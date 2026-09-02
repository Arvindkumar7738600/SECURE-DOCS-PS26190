import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessCase } from '@/lib/auth/authorization';
import { validateFileMetadata, sanitizeFilename } from '@/lib/documents/validation';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction, DocumentType, ProcessingStatus, Prisma } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';
import { getEmbeddingStatus, rankDocumentsBySemanticRelevance } from '@/lib/embeddings/semantic-search';
import {
  storeEncryptedDocumentPlaintext,
  DocumentStorageError,
} from '@/lib/documents/document-bytes';
import fs from 'fs/promises';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// POST /api/v1/cases/{id}/documents - Complete Document Upload & Record Persistence
export async function POST(req: NextRequest, { params }: RouteParams) {
  const caseId = params.id;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));
  let storedDocumentPath: string | null = null;

  const auth = await authorizeRequest(req, 'DOCUMENT_UPLOAD');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  try {
    const hasCaseAccess = await canAccessCase(auth.user.id, auth.user.roles, caseId);
    if (!hasCaseAccess) {
      return NextResponse.json(
        { error: 'Case not found or access denied' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const body = await req.json();
    const {
      documentId,
      storageKey,
      originalFilename,
      mimeType,
      fileSize,
      contentBase64,
      sha256: claimedSha256,
      documentType = DocumentType.OTHER,
      title,
    } = body;

    if (!documentId || !storageKey || !originalFilename || !mimeType || !fileSize || !contentBase64) {
      return NextResponse.json(
        { error: 'documentId, storageKey, originalFilename, mimeType, fileSize, and contentBase64 are required' },
        { status: 400 }
      );
    }

    // Security Verification: Storage Key must match expected server pattern
    const expectedKeyPrefix = `cases/${caseId}/documents/${documentId}`;
    if (!storageKey.startsWith(expectedKeyPrefix)) {
      return NextResponse.json(
        { error: 'Security Error: Storage key does not match expected case/document scope' },
        { status: 403 }
      );
    }

    // Validate metadata
    const validation = validateFileMetadata(originalFilename, mimeType, Number(fileSize));
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.errorCode || 422 });
    }

    const targetCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: { caseNumber: true },
    });

    if (!targetCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const sanitizedName = sanitizeFilename(originalFilename);
    const docTitle = title ? title.trim() : sanitizedName;
    const docTypeEnum = Object.values(DocumentType).includes(documentType as DocumentType)
      ? (documentType as DocumentType)
      : DocumentType.OTHER;

    const plaintextBuffer = Buffer.from(contentBase64, 'base64');
    if (plaintextBuffer.length === 0) {
      return NextResponse.json({ error: 'contentBase64 must contain document bytes' }, { status: 400 });
    }

    const storedDocument = await storeEncryptedDocumentPlaintext(storageKey, plaintextBuffer);
    storedDocumentPath = storedDocument.sourcePath;

    // Atomic Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Document Record
      const doc = await tx.document.create({
        data: {
          id: documentId,
          caseId,
          title: docTitle,
          originalFilename: sanitizedName,
          mimeType,
          documentType: docTypeEnum,
          currentVersion: 1,
          status: ProcessingStatus.COMPLETED,
          createdBy: auth.user!.id,
        },
      });

      // 2. Create Document Version 1 with AES-256-GCM Encryption Parameters
      const version = await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: 1,
          storageKey,
          // Hash the original bytes, never the encrypted storage representation.
          sha256: storedDocument.sha256,
          encryptionAlgorithm: storedDocument.encryptionAlgorithm,
          encryptionVersion: 1,
          iv: storedDocument.iv,
          authTag: storedDocument.authTag,
          uploadedBy: auth.user!.id,
        },
      });

      // 3. Create or Update Document Metadata Record
      await tx.documentMetadata.upsert({
        where: { documentId: doc.id },
        create: {
          documentId: doc.id,
          caseNumber: targetCase.caseNumber,
          summary: `Uploaded ${sanitizedName} (${(Number(fileSize) / 1024).toFixed(1)} KB). Pending OCR & AI Classification.`,
          rawMetadata: {
            fileSize: Number(fileSize),
            originalFilename: sanitizedName,
            mimeType,
            storageKey,
            encryptionStatus: 'AES-256-GCM',
          },
        },
        update: {
          caseNumber: targetCase.caseNumber,
          summary: `Uploaded ${sanitizedName} (${(Number(fileSize) / 1024).toFixed(1)} KB). Pending OCR & AI Classification.`,
          rawMetadata: {
            fileSize: Number(fileSize),
            originalFilename: sanitizedName,
            mimeType,
            storageKey,
            encryptionStatus: 'AES-256-GCM',
          },
        },
      });

      // 4. Create Processing Job (Status: QUEUED)
      const job = await tx.processingJob.create({
        data: {
          documentId: doc.id,
          versionId: version.id,
          status: ProcessingStatus.QUEUED,
          currentStep: 'UPLOADED',
        },
      });

      return { doc, version, job };
    });

    // Async trigger background OCR & AI Embeddings processing
    try {
      const { ProcessingService } = await import('@/lib/processing/processing-service');
      void ProcessingService.processDocumentJob(result.doc.id, result.version.id).catch((err) =>
        safeError('Background processing error after upload', err, requestId)
      );
    } catch {
      // Non-blocking processing kickoff
    }

    // Log Audit Event
    await logAuditEvent({
      userId: auth.user.id,
      caseId,
      documentId: result.doc.id,
      action: AuditAction.UPLOAD_DOCUMENT,
      ipAddress,
      userAgent,
      requestId,
      metadata: {
        filename: sanitizedName,
        fileSize,
        claimedSha256: claimedSha256 || null,
        serverSha256: storedDocument.sha256,
        storageSource: storedDocument.storageSource,
        version: 1,
      },
    });

    return NextResponse.json(
      {
        message: 'Document uploaded and registered successfully',
        document: {
          ...result.doc,
          storageKey,
          sha256: result.version.sha256,
          encryptionStatus: 'AES-256-GCM',
          processingStatus: 'Queued for processing',
        },
      },
      { status: 201, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    if (storedDocumentPath) {
      await fs.rm(storedDocumentPath, { force: true }).catch(() => undefined);
    }

    if (error instanceof DocumentStorageError) {
      safeError('Document storage error during upload', error, requestId);
      return NextResponse.json(
        { error: error.message || 'Document storage unavailable or inaccessible' },
        { status: 500, headers: { [requestIdHeader()]: requestId } }
      );
    }

    safeError('Complete Document Upload API error', error, requestId);
    return NextResponse.json(
      {
        error: error?.message || 'Internal server error completing document upload',
        details: error?.stack ? String(error.message) : undefined,
      },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}

// GET /api/v1/cases/{id}/documents - List Authorized Case Documents
export async function GET(req: NextRequest, { params }: RouteParams) {
  const caseId = params.id;
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'DOCUMENT_READ');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  try {
    const hasCaseAccess = await canAccessCase(auth.user.id, auth.user.roles, caseId);
    if (!hasCaseAccess) {
      return NextResponse.json(
        { error: 'Case not found or access denied' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
    const query = searchParams.get('q')?.trim();
    const docTypeParam = searchParams.get('document_type');

    const whereConditions: Prisma.DocumentWhereInput[] = [{ caseId }];

    if (docTypeParam && Object.values(DocumentType).includes(docTypeParam as DocumentType)) {
      whereConditions.push({ documentType: docTypeParam as DocumentType });
    }

    const baseWhere: Prisma.DocumentWhereInput = { AND: whereConditions };

    const formatDocument = (d: {
      id: string;
      caseId: string;
      title: string;
      originalFilename: string;
      mimeType: string;
      documentType: DocumentType;
      currentVersion: number;
      status: ProcessingStatus;
      uploader: { id: string; fullName: string; email: string } | null;
      versions: Array<{ storageKey: string; sha256: string; createdAt: Date }>;
      metadata: { summary: string | null; rawMetadata: unknown } | null;
      _count: { chunks: number };
      createdAt: Date;
      relevanceScore?: number;
      matchedChunks?: number;
    }) => ({
      id: d.id,
      caseId: d.caseId,
      title: d.title,
      originalFilename: d.originalFilename,
      mimeType: d.mimeType,
      documentType: d.documentType,
      currentVersion: d.currentVersion,
      status: d.status,
      sha256: d.versions[0]?.sha256 || 'N/A',
      storageKey: d.versions[0]?.storageKey || 'N/A',
      encryptionStatus: 'PENDING PHASE 8',
      ocrStatus: 'PENDING PHASE 9',
      classificationStatus: 'PENDING PHASE 10',
      embeddingStatus: getEmbeddingStatus({ chunkCount: d._count?.chunks || 0, documentStatus: d.status }),
      uploader: d.uploader,
      createdAt: d.createdAt,
      relevanceScore: d.relevanceScore,
      matchedChunks: d.matchedChunks,
    });

    if (query) {
      const candidates = await prisma.document.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: { select: { id: true, fullName: true, email: true } },
          versions: {
            where: { versionNumber: 1 },
            select: { storageKey: true, sha256: true, createdAt: true },
          },
          metadata: { select: { summary: true, rawMetadata: true } },
          chunks: { select: { content: true } },
          _count: { select: { chunks: true } },
        },
      });

      const ranked = rankDocumentsBySemanticRelevance(
        query,
        candidates.map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          originalFilename: candidate.originalFilename,
          summary: candidate.metadata?.summary || null,
          chunks: candidate.chunks,
        }))
      );

      const total = ranked.length;
      const formattedDocs = ranked.slice(skip, skip + limit).map((rankedItem) => {
        const doc = candidates.find((candidate) => candidate.id === rankedItem.document.id)!;
        return {
          ...formatDocument(doc),
          relevanceScore: Number(rankedItem.score.toFixed(3)),
          matchedChunks: rankedItem.matchedChunks,
        };
      });

      return NextResponse.json(
        {
          documents: formattedDocs,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
          searchMode: 'SEMANTIC',
          query,
        },
        { status: 200, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const where: Prisma.DocumentWhereInput = baseWhere;

    const [total, docs] = await prisma.$transaction([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: { select: { id: true, fullName: true, email: true } },
          versions: {
            where: { versionNumber: 1 },
            select: { storageKey: true, sha256: true, createdAt: true },
          },
          metadata: { select: { summary: true, rawMetadata: true } },
          _count: { select: { chunks: true } },
        },
      }),
    ]);

    const formattedDocs = docs.map((d) => formatDocument(d));

    return NextResponse.json(
      {
        documents: formattedDocs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        searchMode: 'TEXT',
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('List Documents API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error listing documents' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
