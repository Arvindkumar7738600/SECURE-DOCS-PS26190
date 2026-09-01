import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction, SharePermission } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

const CreateShareSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email address'),
  permission: z.nativeEnum(SharePermission).optional().default(SharePermission.VIEW),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';

  const auth = await authorizeRequest(req, 'SHARE_CREATE');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = CreateShareSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid share parameters', details: parseResult.error.format() }, { status: 400 });
    }

    const { recipientEmail, permission, expiresAt } = parseResult.data;

    // Find recipient user
    const recipient = await prisma.user.findUnique({
      where: { email: recipientEmail.toLowerCase() },
      select: { id: true, email: true, fullName: true },
    });

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient user not found' }, { status: 404 });
    }

    if (recipient.id === auth.user.id) {
      return NextResponse.json({ error: 'Cannot share document with yourself' }, { status: 400 });
    }

    const shareRecord = await prisma.share.create({
      data: {
        documentId: id,
        sharedBy: auth.user.id,
        sharedWith: recipient.id,
        permission,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        recipient: {
          select: { id: true, email: true, fullName: true, department: true },
        },
        sharer: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    await logAuditEvent({
      userId: auth.user.id,
      documentId: id,
      action: AuditAction.SHARE_DOCUMENT,
      ipAddress,
      userAgent,
      metadata: {
        shareId: shareRecord.id,
        sharedWith: recipient.id,
        recipientEmail: recipient.email,
        permission,
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        message: 'Document shared successfully',
        share: shareRecord,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Share Document API error:', error);
    return NextResponse.json({ error: 'Internal server error sharing document' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params;

  const auth = await authorizeRequest(req, 'SHARE_READ');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    const shares = await prisma.share.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        recipient: {
          select: { id: true, email: true, fullName: true, department: true },
        },
        sharer: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    return NextResponse.json(
      {
        documentId: id,
        shares,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get Shares API error:', error);
    return NextResponse.json({ error: 'Internal server error fetching shares' }, { status: 500 });
  }
}
