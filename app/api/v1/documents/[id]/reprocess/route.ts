import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { ProcessingService } from '@/lib/processing/processing-service';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction, ProcessingStatus } from '@prisma/client';

import { storeEncryptedDocumentPlaintext } from '@/lib/documents/document-bytes';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';

  const auth = await authorizeRequest(req, 'DOCUMENT_UPLOAD');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!document || document.versions.length === 0) {
      return NextResponse.json({ error: 'Document or version record not found' }, { status: 404 });
    }

    // Optional re-upload Base64 buffer attachment
    const body = await req.json().catch(() => ({}));
    if (body?.contentBase64) {
      const cleanBase64 = String(body.contentBase64).replace(/^data:[^;]+;base64,/, '').trim();
      const plaintextBuffer = Buffer.from(cleanBase64, 'base64');
      if (plaintextBuffer.length > 0) {
        const version = document.versions[0];
        const stored = await storeEncryptedDocumentPlaintext(version.storageKey, plaintextBuffer);

        const currentMeta = await prisma.documentMetadata.findUnique({ where: { documentId: id } });
        const existingRaw = (currentMeta?.rawMetadata as any) || {};

        await prisma.documentMetadata.upsert({
          where: { documentId: id },
          create: {
            documentId: id,
            rawMetadata: { ...existingRaw, ciphertextBase64: stored.ciphertext.toString('base64') },
          },
          update: {
            rawMetadata: { ...existingRaw, ciphertextBase64: stored.ciphertext.toString('base64') },
          },
        });
      }
    }

    // Reset or create new ProcessingJob
    await prisma.processingJob.create({
      data: {
        documentId: id,
        versionId: document.versions[0].id,
        status: ProcessingStatus.QUEUED,
        currentStep: 'REPROCESS_REQUESTED',
      },
    });

    const result = await ProcessingService.processDocumentJob(id);

    await logAuditEvent({
      userId: auth.user.id,
      documentId: id,
      action: AuditAction.PROCESS_DOCUMENT,
      ipAddress,
      userAgent,
      metadata: { action: 'REPROCESS', resultSuccess: result.success },
    });

    return NextResponse.json(
      { message: 'Document reprocessed successfully', result },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Reprocess Document API error:', error);
    return NextResponse.json({ error: 'Internal server error reprocessing document' }, { status: 500 });
  }
}
