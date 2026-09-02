import { NextRequest } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';
import { verifyDocumentIntegrity } from '@/lib/documents/document-bytes';
import { jsonResponseWithRequestId } from '@/lib/observability/response';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'DOCUMENT_VERIFY');
  if (!auth.authorized || !auth.user) {
    return jsonResponseWithRequestId({ error: 'Unauthorized' }, 401, requestId);
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return jsonResponseWithRequestId({ error: 'Document not found or access denied' }, 404, requestId);
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!document || document.versions.length === 0) {
      return jsonResponseWithRequestId({ error: 'Document or version record not found' }, 404, requestId);
    }

    const latestVersion = document.versions[0];
    const expectedSha256 = latestVersion.sha256.toLowerCase();

    const integrityResult = await verifyDocumentIntegrity({
      storageKey: latestVersion.storageKey,
      encryptionAlgorithm: latestVersion.encryptionAlgorithm,
      iv: latestVersion.iv,
      authTag: latestVersion.authTag,
    }, expectedSha256);

    const computedSha256 = integrityResult.computedSha256;
    const integrityStatus = integrityResult.status;

    // Log Audit Event
    await logAuditEvent({
      userId: auth.user.id,
      caseId: document.caseId,
      documentId: document.id,
      action: AuditAction.VERIFY_INTEGRITY,
      ipAddress,
      userAgent,
      metadata: {
        expectedSha256,
        computedSha256,
        status: integrityStatus,
        versionNumber: latestVersion.versionNumber,
        storageSource: integrityResult.storageSource,
      },
      requestId,
    });

    return jsonResponseWithRequestId(
      {
        status: integrityStatus,
        message: integrityResult.message,
        documentId: document.id,
        versionNumber: latestVersion.versionNumber,
        expectedSha256,
        computedSha256,
        verifiedAt: new Date().toISOString(),
      },
      200,
      requestId
    );
  } catch (error: any) {
    safeError('Verify Document Integrity API error', error, requestId);
    return jsonResponseWithRequestId(
      { error: 'Internal server error verifying document integrity' },
      500,
      requestId
    );
  }
}
