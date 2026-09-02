import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessCase } from '@/lib/auth/authorization';
import { UpdateCaseSchema } from '@/lib/cases/validation';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction, RoleName, CaseStatus } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET /api/v1/cases/{id} - Get Case Details
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
      // Return 404 to avoid leaking resource existence for unauthorized users
      return NextResponse.json(
        { error: 'Case not found or access denied' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const targetCase = await prisma.case.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, fullName: true, email: true, department: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, department: true, userRoles: { include: { role: true } } },
            },
          },
        },
        documents: {
          select: {
            id: true,
            title: true,
            originalFilename: true,
            mimeType: true,
            documentType: true,
            currentVersion: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!targetCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    return NextResponse.json(
      { case: targetCase },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('Get Case API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error getting case' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}

// PATCH /api/v1/cases/{id} - Update Case
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'CASE_UPDATE');
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
    const parseResult = UpdateCaseSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const updateData = parseResult.data;

    const updatedCase = await prisma.case.update({
      where: { id },
      data: updateData,
    });

    await logAuditEvent({
      userId: auth.user.id,
      caseId: id,
      action: AuditAction.UPDATE_CASE,
      ipAddress,
      userAgent,
      requestId,
      metadata: { updatedFields: Object.keys(updateData) },
    });

    return NextResponse.json(
      { message: 'Case updated successfully', case: updatedCase },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('Update Case API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error updating case' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}

// DELETE /api/v1/cases/{id} - Archive or Delete Case
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'CASE_DELETE');
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

    const isAdmin = auth.user.roles.includes(RoleName.ADMIN);

    if (isAdmin) {
      // Permanent hard deletion for ADMIN
      await prisma.case.delete({ where: { id } });
    } else {
      // Controlled archival for non-ADMIN
      await prisma.case.update({
        where: { id },
        data: { status: CaseStatus.ARCHIVED },
      });
    }

    await logAuditEvent({
      userId: auth.user.id,
      caseId: id,
      action: AuditAction.DELETE_CASE,
      ipAddress,
      userAgent,
      requestId,
      metadata: { actionType: isAdmin ? 'HARD_DELETE' : 'ARCHIVED' },
    });

    return NextResponse.json(
      { message: isAdmin ? 'Case deleted permanently' : 'Case archived successfully' },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('Delete Case API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error deleting case' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
