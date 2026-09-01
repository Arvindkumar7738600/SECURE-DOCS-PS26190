import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string; shareId: string };
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id, shareId } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';

  const auth = await authorizeRequest(req, 'SHARE_REVOKE');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    const share = await prisma.share.findFirst({
      where: { id: shareId, documentId: id },
    });

    if (!share) {
      return NextResponse.json({ error: 'Share record not found' }, { status: 404 });
    }

    if (share.revokedAt) {
      return NextResponse.json({ error: 'Share is already revoked' }, { status: 400 });
    }

    const updatedShare = await prisma.share.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });

    await logAuditEvent({
      userId: auth.user.id,
      documentId: id,
      action: AuditAction.REVOKE_SHARE,
      ipAddress,
      userAgent,
      metadata: {
        shareId: share.id,
        revokedRecipientId: share.sharedWith,
      },
    });

    return NextResponse.json(
      {
        message: 'Share revoked successfully',
        share: updatedShare,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Revoke Share API error:', error);
    return NextResponse.json({ error: 'Internal server error revoking share' }, { status: 500 });
  }
}
