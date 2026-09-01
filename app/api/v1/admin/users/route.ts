import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';
import { RoleName, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_ROLES = Object.values(RoleName) as string[];

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'USER_READ');
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
    const roleParam = searchParams.get('role')?.toUpperCase();
    const isActiveParam = searchParams.get('isActive');

    const whereConditions: Prisma.UserWhereInput[] = [];

    if (q) {
      whereConditions.push({
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { department: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (roleParam && VALID_ROLES.includes(roleParam)) {
      whereConditions.push({
        userRoles: {
          some: {
            role: { name: roleParam as RoleName },
          },
        },
      });
    }

    if (isActiveParam === 'true') {
      whereConditions.push({ isActive: true });
    } else if (isActiveParam === 'false') {
      whereConditions.push({ isActive: false });
    }

    const where: Prisma.UserWhereInput =
      whereConditions.length > 0 ? { AND: whereConditions } : {};

    const [total, rawUsers] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          department: true,
          isActive: true,
          mfaEnabled: true,
          createdAt: true,
          userRoles: {
            select: {
              id: true,
              role: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const users = rawUsers.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      department: u.department,
      isActive: u.isActive,
      mfaEnabled: u.mfaEnabled,
      createdAt: u.createdAt,
      roles: u.userRoles.map((ur) => ur.role.name),
      // Expose userRoleId for the first role so the PATCH can target it
      userRoleId: u.userRoles[0]?.id ?? null,
    }));

    return NextResponse.json(
      {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error) {
    safeError('Admin Users list API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error listing users' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
