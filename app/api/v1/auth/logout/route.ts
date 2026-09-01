import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const response = NextResponse.json(
    { message: 'Logout successful' },
    {
      status: 200,
      headers: { [requestIdHeader()]: requestId }
    }
  );

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  try {
    const user = await getCurrentUser(req);

    if (user) {
      await logAuditEvent({
        userId: user.id,
        action: AuditAction.LOGOUT,
        ipAddress,
        userAgent,
        requestId,
        metadata: { email: user.email },
      });
    }
  } catch (error) {
    console.error('Logout audit logging error:', error instanceof Error ? error.message : 'Unknown error');
  }

  return response;
}
