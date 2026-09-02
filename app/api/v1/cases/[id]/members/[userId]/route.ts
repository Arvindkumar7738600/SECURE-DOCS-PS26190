import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessCase } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string; userId: string };
}

// DELETE /api/v1/cases/{id}/members/{userId} - Remove Case Member
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id: caseId, userId: targetUserId } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'CASE_MEMBER_MANAGE');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  try {
    const hasAccess = await canAccessCase(auth.user.id, auth.user.roles, caseId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Case not found or access denied' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const member = await prisma.caseMember.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId: targetUserId,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Case member record not found' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    await prisma.caseMember.delete({
      where: { id: member.id },
    });

    await logAuditEvent({
      userId: auth.user.id,
      caseId,
      action: AuditAction.CASE_MEMBER_REMOVED,
      ipAddress,
      userAgent,
      requestId,
      metadata: { removedUserId: targetUserId },
    });

    return NextResponse.json(
      { message: 'Case member removed successfully' },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('Remove Case Member API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error removing member' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
