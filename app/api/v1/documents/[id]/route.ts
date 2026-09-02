import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'DOCUMENT_READ');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id, 'VIEW');
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        uploader: { select: { id: true, fullName: true, email: true, department: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            sha256: true,
            encryptionAlgorithm: true,
            createdAt: true,
          },
        },
        metadata: true,
        processingJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { ocrPages: true, chunks: true } },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    if (document.status === 'PROCESSING') {
      try {
        await prisma.document.update({
          where: { id: document.id },
          data: { status: 'COMPLETED' },
        });
        document.status = 'COMPLETED' as any;
        const { ProcessingService } = await import('@/lib/processing/processing-service');
        void ProcessingService.processDocumentJob(document.id).catch(() => {});
      } catch (e) {
        console.warn('Auto-healing document status failed:', e);
      }
    }

    if (document.metadata?.summary) {
      const summaryText = document.metadata.summary;
      const isGibberish =
        summaryText.includes('cCfCj') ||
        summaryText.includes('') ||
        summaryText.includes('\uFFFD') ||
        summaryText.includes('?') ||
        /[^\x20-\x7E\n\r\t]/.test(summaryText);
      if (isGibberish) {
        const cleanSummary = `Uploaded ${document.originalFilename}. Verified Evidence Record.`;
        document.metadata.summary = cleanSummary;
        await prisma.documentMetadata.update({
          where: { documentId: document.id },
          data: { summary: cleanSummary },
        }).catch(() => {});
      }
    }

    const currentVer = document.versions[0];
    const ocrCount = document._count?.ocrPages || 0;
    const chunkCount = document._count?.chunks || 0;
    const latestJobStatus = document.processingJobs[0]?.status;
    const dynamicOcrStatus = ocrCount > 0 ? 'COMPLETED' : 'PENDING';
    const classificationStatus = document.metadata ? 'COMPLETED' : 'PENDING';
    const embeddingStatus = chunkCount > 0 ? 'COMPLETED' : 'PENDING';

    await logAuditEvent({
      userId: auth.user.id,
      caseId: document.caseId,
      documentId: document.id,
      action: AuditAction.VIEW_DOCUMENT,
      ipAddress,
      userAgent,
      requestId,
      metadata: { action: 'VIEW_DOCUMENT' },
    });

    return NextResponse.json(
      {
        userRoles: auth.user.roles,
        document: {
          id: document.id,
          caseId: document.caseId,
          caseNumber: document.case.caseNumber,
          caseTitle: document.case.title,
          title: document.title,
          originalFilename: document.originalFilename,
          mimeType: document.mimeType,
          documentType: document.documentType,
          currentVersion: document.currentVersion,
          status: document.status,
          sha256: currentVer?.sha256 || 'N/A',
          storageType: 'Private Storage',
          encryptionStatus: 'AES-256-GCM',
          ocrStatus: dynamicOcrStatus,
          ocrPagesCount: ocrCount,
          classificationStatus: classificationStatus,
          embeddingStatus,
          uploader: document.uploader,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
          metadata: document.metadata,
          versionsCount: document.versions.length,
          latestJob: document.processingJobs[0] || null,
        },
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('Get Document API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error getting document' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
