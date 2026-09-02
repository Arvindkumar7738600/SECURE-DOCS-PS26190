import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessCase } from '@/lib/auth/authorization';
import { AddCaseMemberSchema } from '@/lib/cases/validation';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction, RoleName } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET /api/v1/cases/{id}/members - List Case Members
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));
  const auth = await authorizeRequest(req, 'CASE_READ');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  try {
    const hasAccess = await canAccessCase(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Case not found or access denied' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const members = await prisma.caseMember.findMany({
      where: { caseId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            department: true,
            isActive: true,
            userRoles: {
              include: { role: true },
            },
          },
        },
      },
    });

    const safeMembers = members.map((m) => ({
      id: m.id,
      caseId: m.caseId,
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt,
      user: {
        id: m.user.id,
        email: m.user.email,
        fullName: m.user.fullName,
        department: m.user.department,
        globalRoles: m.user.userRoles.map((ur) => ur.role.name),
      },
    }));

    return NextResponse.json(
      { members: safeMembers },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('List Case Members API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error listing members' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}

// POST /api/v1/cases/{id}/members - Add Member to Case
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
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
    const hasAccess = await canAccessCase(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Case not found or access denied' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const body = await req.json();
    const parseResult = AddCaseMemberSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { userId, role = RoleName.INVESTIGATOR } = parseResult.data;

    // Check target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser || !targetUser.isActive) {
      return NextResponse.json(
        { error: 'Target user not found or inactive' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    // Check duplicate membership
    const existingMember = await prisma.caseMember.findUnique({
      where: {
        caseId_userId: {
          caseId: id,
          userId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this case' },
        { status: 409, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const newMember = await prisma.caseMember.create({
      data: {
        caseId: id,
        userId,
        role,
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, department: true },
        },
      },
    });

    await logAuditEvent({
      userId: auth.user.id,
      caseId: id,
      action: AuditAction.CASE_MEMBER_ADDED,
      ipAddress,
      userAgent,
      requestId,
      metadata: { addedUserId: userId, memberRole: role },
    });

    return NextResponse.json(
      { message: 'Case member added successfully', member: newMember },
      { status: 201, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('Add Case Member API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error adding member' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
