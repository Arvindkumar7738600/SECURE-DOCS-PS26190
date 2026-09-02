import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { OCRService, sanitizeUtf8 } from '@/lib/ocr/service';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction, ProcessingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    const version = document.versions[0];

    // Parse request body for base64 content
    const body = await req.json().catch(() => ({}));
    if (!body?.contentBase64) {
      return NextResponse.json(
        { error: 'Missing contentBase64 in request body. Please re-upload the evidence file.' },
        { status: 400 }
      );
    }

    const cleanBase64 = String(body.contentBase64).replace(/^data:[^;]+;base64,/, '').trim();
    const plaintextBuffer = Buffer.from(cleanBase64, 'base64');

    if (plaintextBuffer.length === 0) {
      return NextResponse.json(
        { error: 'Uploaded file is empty. Please select a valid evidence file.' },
        { status: 400 }
      );
    }

    // Run OCR FIRST — this is the critical path the user is waiting for
    const ocrResult = await OCRService.processDocument(plaintextBuffer, document.mimeType);

    if (!ocrResult.success || ocrResult.pages.length === 0) {
      return NextResponse.json(
        { error: ocrResult.error || 'OCR text extraction returned no pages. The image may not contain readable text.' },
        { status: 422 }
      );
    }

    // Store OCR pages and mark document COMPLETED
    await prisma.$transaction(async (tx) => {
      await tx.ocrPage.deleteMany({ where: { versionId: version.id } });

      for (const p of ocrResult.pages) {
        const cleanText = sanitizeUtf8(p.text);
        await tx.ocrPage.create({
          data: {
            documentId: document.id,
            versionId: version.id,
            pageNumber: p.pageNumber,
            text: cleanText,
            confidence: p.confidence,
            method: p.method,
          },
        });
      }

      await tx.document.update({
        where: { id: document.id },
        data: { status: ProcessingStatus.COMPLETED },
      });
    });

    // Fire-and-forget: store encrypted copy + audit log (non-blocking)
    const userId = auth.user.id;
    void (async () => {
      try {
        const { storeEncryptedDocumentPlaintext } = await import('@/lib/documents/document-bytes');
        const stored = await storeEncryptedDocumentPlaintext(version.storageKey, plaintextBuffer);
        await prisma.documentVersion.update({
          where: { id: version.id },
          data: { iv: stored.iv, authTag: stored.authTag, encryptionAlgorithm: stored.encryptionAlgorithm },
        });
        const currentMeta = await prisma.documentMetadata.findUnique({ where: { documentId: id } });
        const existingRaw = (currentMeta?.rawMetadata as any) || {};
        await prisma.documentMetadata.upsert({
          where: { documentId: id },
          create: { documentId: id, rawMetadata: { ...existingRaw, ciphertextBase64: stored.ciphertext.toString('base64') } },
          update: { rawMetadata: { ...existingRaw, ciphertextBase64: stored.ciphertext.toString('base64') } },
        });
      } catch (e) { console.warn('Background storage failed:', e); }
      try {
        await logAuditEvent({
          userId,
          documentId: id,
          action: AuditAction.PROCESS_DOCUMENT,
          ipAddress,
          userAgent,
          metadata: { action: 'REPROCESS', pagesCount: ocrResult.pages.length },
        });
      } catch (e) { console.warn('Audit log failed:', e); }
    })();

    return NextResponse.json(
      {
        message: 'Document reprocessed successfully',
        result: { success: true, pagesCount: ocrResult.pages.length },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Reprocess Document API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error reprocessing document' },
      { status: 500 }
    );
  }
}
