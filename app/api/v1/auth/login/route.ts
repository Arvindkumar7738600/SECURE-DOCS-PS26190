import { NextRequest, NextResponse } from 'next/server';
import { LoginSchema } from '@/lib/auth/validation';
import { verifyPassword } from '@/lib/security/password';
import { signJWT, signMfaChallengeToken } from '@/lib/security/jwt';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const rateLimitResult = checkRateLimit(`login:${ipAddress}`, 10, 15 * 60 * 1000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)), [requestIdHeader()]: requestId } }
    );
  }

  try {
    const body = await req.json();
    const parseResult = LoginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase();

    // 1. Find User
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      await logAuditEvent({
        userId: user?.id || null,
        action: AuditAction.FAILED_ACCESS,
        ipAddress,
        userAgent,
        requestId,
        metadata: { email: normalizedEmail, reason: 'Invalid email or user inactive' },
      });

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401, headers: { [requestIdHeader()]: requestId } }
      );
    }

    // 2. Verify Password
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      await logAuditEvent({
        userId: user.id,
        action: AuditAction.FAILED_ACCESS,
        ipAddress,
        userAgent,
        requestId,
        metadata: { email: normalizedEmail, reason: 'Password mismatch' },
      });

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const roles = (user.userRoles || [])
      .map((ur) => ur?.role?.name)
      .filter((name): name is string => Boolean(name));

    // 3. MFA Challenge Flow if MFA enabled
    if (user.mfaEnabled) {
      const challengeToken = await signMfaChallengeToken(user.id, user.email);

      return NextResponse.json(
        {
          requiresMfa: true,
          challengeToken,
          message: 'MFA verification required. Please submit your TOTP code or recovery code.',
        },
        { status: 200, headers: { [requestIdHeader()]: requestId } }
      );
    }

    // 4. Issue Normal Authenticated Session if MFA disabled
    const token = await signJWT({
      sub: user.id,
      email: user.email,
      roles,
    });

    await logAuditEvent({
      userId: user.id,
      action: AuditAction.LOGIN,
      ipAddress,
      userAgent,
      requestId,
      metadata: { email: user.email, roles },
    });

    const response = NextResponse.json(
      {
        requiresMfa: false,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          department: user.department,
          isActive: user.isActive,
          mfaEnabled: user.mfaEnabled,
          roles,
        },
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch (error: any) {
    safeError('Login API error', error, requestId);
    return NextResponse.json(
      {
        error: error?.message || 'Internal server error during login',
        details: error?.message,
      },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
