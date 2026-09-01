import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';
import { AuditAction, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS = Object.values(AuditAction) as string[];

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'AUDIT_READ');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse ?? NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10)));
    const skip = (page - 1) * limit;

    const q = searchParams.get('q')?.trim();
    const actionParam = searchParams.get('action')?.toUpperCase();
    const userId = searchParams.get('userId')?.trim();
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const whereConditions: Prisma.AuditLogWhereInput[] = [];

    if (q) {
      whereConditions.push({
        OR: [
          { ipAddress: { contains: q, mode: 'insensitive' } },
          { userAgent: { contains: q, mode: 'insensitive' } },
          {
            user: {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
    }

    if (actionParam && VALID_ACTIONS.includes(actionParam)) {
      whereConditions.push({ action: actionParam as AuditAction });
    }

    if (userId) {
      whereConditions.push({ userId });
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      if (!isNaN(from.getTime())) {
        whereConditions.push({ timestamp: { gte: from } });
      }
    }

    if (dateTo) {
      const to = new Date(dateTo);
      if (!isNaN(to.getTime())) {
        // Include the full day
        to.setHours(23, 59, 59, 999);
        whereConditions.push({ timestamp: { lte: to } });
      }
    }

    const where: Prisma.AuditLogWhereInput =
      whereConditions.length > 0 ? { AND: whereConditions } : {};

    const [total, logs] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          action: true,
          timestamp: true,
          ipAddress: true,
          userAgent: true,
          metadata: true,
          userId: true,
          caseId: true,
          documentId: true,
          user: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json(
      {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        validActions: VALID_ACTIONS,
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error) {
    safeError('Admin Audit Logs API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error listing audit logs' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
