import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, UserSession } from '@/lib/auth/session';
import { Permission, hasPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction, RoleName } from '@prisma/client';

export interface AuthResult {
  authorized: boolean;
  user: UserSession | null;
  errorResponse?: NextResponse;
}

export async function authorizeRequest(
  req: NextRequest,
  permission?: Permission
): Promise<AuthResult> {
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';

  const user = await getCurrentUser(req);

  if (!user) {
    return {
      authorized: false,
      user: null,
      errorResponse: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }),
    };
  }

  if (permission && !hasPermission(user.roles, permission)) {
    await logAuditEvent({
      userId: user.id,
      action: AuditAction.FAILED_ACCESS,
      ipAddress,
      userAgent,
      metadata: {
        reason: 'Insufficient permissions',
        requiredPermission: permission,
        userRoles: user.roles,
        path: req.nextUrl.pathname,
      },
    });

    return {
      authorized: false,
      user,
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user,
  };
}

export async function canAccessCase(
  userId: string,
  userRoles: string[],
  caseId: string
): Promise<boolean> {
  // ADMIN role has global access
  if (userRoles.includes(RoleName.ADMIN)) {
    return true;
  }

  // AUDITOR role has read access to all cases for auditing
  if (userRoles.includes(RoleName.AUDITOR)) {
    return true;
  }

  const targetCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { createdBy: true },
  });

  if (!targetCase) return false;

  // Case creator has full access
  if (targetCase.createdBy === userId) {
    return true;
  }

  // Check explicit case membership
  const member = await prisma.caseMember.findUnique({
    where: {
      caseId_userId: {
        caseId,
        userId,
      },
    },
  });

  return Boolean(member);
}

export async function canAccessDocument(
  userId: string,
  userRoles: string[],
  documentId: string,
  action: 'VIEW' | 'DOWNLOAD' = 'VIEW'
): Promise<boolean> {
  if (userRoles.includes(RoleName.ADMIN)) {
    return true;
  }

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { caseId: true, createdBy: true },
  });

  if (!doc) return false;

  // Document uploader has access
  if (doc.createdBy === userId) return true;

  // Check case access
  const hasCaseAccess = await canAccessCase(userId, userRoles, doc.caseId);
  if (hasCaseAccess) return true;

  // Check active shares
  const now = new Date();
  const activeShare = await prisma.share.findFirst({
    where: {
      documentId,
      sharedWith: userId,
      revokedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
  });

  if (!activeShare) return false;

  // If share permission is VIEW, deny DOWNLOAD action
  if (action === 'DOWNLOAD' && activeShare.permission !== 'DOWNLOAD') {
    return false;
  }

  return true;
}
