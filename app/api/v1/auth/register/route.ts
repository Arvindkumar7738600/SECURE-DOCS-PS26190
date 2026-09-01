import { NextRequest, NextResponse } from 'next/server';
import { RegisterSchema } from '@/lib/auth/validation';
import { hashPassword } from '@/lib/security/password';
import { prisma } from '@/lib/db/prisma';
import { RoleName } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';
import { z } from 'zod';

const AdminRegisterSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters long'),
  department: z.string().min(2, 'Department is required'),
  role: z.nativeEnum(RoleName),
});

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const rateLimitResult = checkRateLimit(`register:${ipAddress}`, 5, 60 * 60 * 1000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const requestedRole = typeof body?.role === 'string' ? body.role : RoleName.VIEWER;
    const wantsPrivilegedRole = requestedRole !== RoleName.VIEWER;
    const currentUser = wantsPrivilegedRole ? await getCurrentUser(req) : null;
    const isAdminCreator = currentUser?.roles?.includes(RoleName.ADMIN) === true;

    if (wantsPrivilegedRole && !isAdminCreator) {
      return NextResponse.json(
        { error: 'Only an authorized ADMIN can assign non-viewer roles.' },
        { status: 403, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const parseResult = (isAdminCreator && wantsPrivilegedRole ? AdminRegisterSchema : RegisterSchema).safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { email, password, fullName, department } = parseResult.data;
    const assignedRole = 'role' in parseResult.data && parseResult.data.role ? parseResult.data.role : RoleName.VIEWER;

    // Check duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Public registration is restricted to the safe default role only.
    let dbRole = await prisma.role.findUnique({
      where: { name: assignedRole },
    });

    if (!dbRole) {
      dbRole = await prisma.role.create({
        data: { name: assignedRole },
      });
    }

    // Hash password & create user
    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        department,
        isActive: true,
        mfaEnabled: false,
        userRoles: {
          create: {
            roleId: dbRole.id,
          },
        },
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Never return passwordHash
    return NextResponse.json(
      {
        message: 'User registered successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          department: newUser.department,
          isActive: newUser.isActive,
          mfaEnabled: newUser.mfaEnabled,
          roles: newUser.userRoles.map((ur) => ur.role.name),
          createdAt: newUser.createdAt,
        },
      },
      {
        status: 201,
        headers: { [requestIdHeader()]: requestId }
      }
    );
  } catch (error: any) {
    safeError('Registration API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      {
        status: 500,
        headers: { [requestIdHeader()]: requestId }
      }
    );
  }
}
