import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';
import { loadDocumentPlaintext } from '@/lib/documents/document-bytes';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'DOCUMENT_DOWNLOAD');
  if (!auth.authorized || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id, 'DOWNLOAD');
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!document || document.versions.length === 0) {
      return NextResponse.json(
        { error: 'Document record not found' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const version = document.versions[0];

    let plaintextBuffer: Buffer;

    try {
      const resolvedBytes = await loadDocumentPlaintext({
        storageKey: version.storageKey,
        encryptionAlgorithm: version.encryptionAlgorithm,
        iv: version.iv,
        authTag: version.authTag,
      });
      plaintextBuffer = resolvedBytes.plaintext;
    } catch (err: any) {
      safeError('Decryption error during download', err, requestId);
      return NextResponse.json(
        { error: 'Security Error: Document decryption or GCM authentication failed' },
        { status: 500, headers: { [requestIdHeader()]: requestId } }
      );
    }

    // Audit Event
    await logAuditEvent({
      userId: auth.user.id,
      caseId: document.caseId,
      documentId: document.id,
      action: AuditAction.DOWNLOAD_DOCUMENT,
      ipAddress,
      userAgent,
      requestId,
      metadata: { filename: document.originalFilename, versionNumber: version.versionNumber },
    });

    const safeFilename = document.originalFilename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return new NextResponse(new Uint8Array(plaintextBuffer), {
      status: 200,
      headers: {
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(document.originalFilename)}`,
        'Content-Length': plaintextBuffer.length.toString(),
        [requestIdHeader()]: requestId,
      },
    });
  } catch (error: any) {
    safeError('Download Document API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error downloading document' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
