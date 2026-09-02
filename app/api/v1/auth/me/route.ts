import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          department: user.department,
          isActive: user.isActive,
          mfaEnabled: user.mfaEnabled,
          roles: user.roles,
          createdAt: user.createdAt,
        },
      },
      {
        status: 200,
        headers: { [requestIdHeader()]: requestId }
      }
    );
  } catch (error: any) {
    safeError('/me API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: { [requestIdHeader()]: requestId }
      }
    );
  }
}
