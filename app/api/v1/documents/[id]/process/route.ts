import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { ProcessingService } from '@/lib/processing/processing-service';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';

  const rateLimitResult = checkRateLimit(`process:${ipAddress}`, 20, 60 * 60 * 1000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many processing requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)) } }
    );
  }

  const auth = await authorizeRequest(req, 'DOCUMENT_UPLOAD');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    const result = await ProcessingService.processDocumentJob(id);

    await logAuditEvent({
      userId: auth.user.id,
      documentId: id,
      action: AuditAction.PROCESS_DOCUMENT,
      ipAddress,
      userAgent,
      metadata: { resultSuccess: result.success, pagesCount: result.pagesCount },
    });

    if (!result.success) {
      console.error('Document processing failed:', result.error);
      return NextResponse.json(
        { error: 'Document processing failed. Please try again or contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Document processed successfully', result },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Process Document API error:', error);
    return NextResponse.json({ error: 'Internal server error processing document' }, { status: 500 });
  }
}
