import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { ProcessingService } from '@/lib/processing/processing-service';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction, ProcessingStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Internal';

    const auth = await authorizeRequest(req, 'DOCUMENT_UPLOAD');
    if (!auth.authorized || !auth.user) {
      return auth.errorResponse || NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
      { success: true, message: 'Document reprocessed successfully', result },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Reprocess Document API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
