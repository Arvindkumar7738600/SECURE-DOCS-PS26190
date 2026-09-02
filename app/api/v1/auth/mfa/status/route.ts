import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
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
        { status: 401, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const device = await prisma.mfaDevice.findFirst({
      where: { userId: user.id },
      select: { isVerified: true, updatedAt: true },
    });

    return NextResponse.json(
      {
        enabled: user.mfaEnabled,
        configured: Boolean(device?.isVerified),
        lastConfiguredAt: device?.updatedAt || null,
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('MFA status error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
