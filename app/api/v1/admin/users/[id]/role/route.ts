import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';
import { AuditAction, RoleName } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const RoleChangeSchema = z.object({
  toRole: z.nativeEnum(RoleName),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));
  const ipAddress = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const userAgent = req.headers.get('user-agent') ?? 'Internal';

  const auth = await authorizeRequest(req, 'USER_MANAGE');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse ?? NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  const { id: targetUserId } = params;

  try {
    const body = await req.json();
    const parsed = RoleChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 422, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const { toRole } = parsed.data;

    // Load target user with their current roles
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    // Prevent changing own role
    if (targetUserId === auth.user.id) {
      return NextResponse.json(
        { error: 'You cannot change your own role.' },
        { status: 400, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const currentRoles = targetUser.userRoles.map((ur) => ur.role.name);
    const isCurrentlyAdmin = currentRoles.includes(RoleName.ADMIN);

    // Guard: prevent removing the last ADMIN
    if (isCurrentlyAdmin && toRole !== RoleName.ADMIN) {
      const adminCount = await prisma.userRole.count({
        where: { role: { name: RoleName.ADMIN } },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot change the role of the last ADMIN. Promote another user first.' },
          { status: 400, headers: { [requestIdHeader()]: requestId } }
        );
      }
    }

    // Prevent promoting to ADMIN via this endpoint (safety: only manual DB ops)
    if (toRole === RoleName.ADMIN) {
      return NextResponse.json(
        { error: 'Promoting users to ADMIN is not allowed via this endpoint for safety reasons.' },
        { status: 403, headers: { [requestIdHeader()]: requestId } }
      );
    }

    // Look up the target role record
    const targetRoleRecord = await prisma.role.findUnique({ where: { name: toRole } });
    if (!targetRoleRecord) {
      return NextResponse.json(
        { error: `Role "${toRole}" does not exist in the database.` },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const previousRoles = currentRoles;

    // Transaction: remove all existing roles, add new role
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: targetUserId } });
      await tx.userRole.create({
        data: {
          userId: targetUserId,
          roleId: targetRoleRecord.id,
        },
      });
    });

    // Audit the admin action
    await logAuditEvent({
      userId: auth.user.id,
      action: AuditAction.ADMIN_ACTION,
      ipAddress,
      userAgent,
      requestId,
      metadata: {
        adminAction: 'ROLE_CHANGE',
        targetUserId,
        targetUserEmail: targetUser.email,
        previousRoles,
        newRole: toRole,
      },
    });

    // Return updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        fullName: true,
        department: true,
        isActive: true,
        createdAt: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });

    return NextResponse.json(
      {
        message: `Role updated to ${toRole} successfully.`,
        user: {
          ...updatedUser,
          roles: updatedUser?.userRoles.map((ur) => ur.role.name) ?? [],
        },
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error) {
    safeError('Admin role change API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error during role change' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
