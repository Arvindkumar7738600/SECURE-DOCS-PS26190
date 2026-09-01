import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/security/password';
import { decryptText } from '@/lib/security/encryption';
import { verifyTotpCode, hashRecoveryCode } from '@/lib/auth/mfa';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthenticated' },
        { status: 401, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const body = await req.json();
    const { password, totpCode, recoveryCode } = body;

    if (!password || (!totpCode && !recoveryCode)) {
      return NextResponse.json(
        { error: 'Password and either totpCode or recoveryCode are required to disable MFA' },
        { status: 400 }
      );
    }

    // 1. Verify Password
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { mfaDevices: true },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const isPasswordValid = await verifyPassword(password, dbUser.passwordHash);
    if (!isPasswordValid) {
      await logAuditEvent({
        userId: user.id,
        action: AuditAction.FAILED_ACCESS,
        ipAddress,
        userAgent,
        requestId,
        metadata: { reason: 'Password verification failed during MFA disable attempt' },
      });

      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401, headers: { [requestIdHeader()]: requestId } }
      );
    }

    // 2. Verify TOTP or Recovery Code
    if (dbUser.mfaDevices.length === 0) {
      return NextResponse.json(
        { error: 'MFA is not configured' },
        { status: 400, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const device = dbUser.mfaDevices[0];
    const secret = decryptText(device.secretEncrypted);
    let isCodeValid = false;

    if (totpCode) {
      isCodeValid = verifyTotpCode(totpCode, secret);
    }

    if (!isCodeValid && recoveryCode) {
      const inputHash = hashRecoveryCode(recoveryCode);
      const storedCodes = (device.recoveryCodes as { codeHash: string; used: boolean }[]) || [];
      const match = storedCodes.find((rc) => rc.codeHash === inputHash && !rc.used);
      if (match) isCodeValid = true;
    }

    if (!isCodeValid) {
      await logAuditEvent({
        userId: user.id,
        action: AuditAction.MFA_FAILED,
        ipAddress,
        userAgent,
        requestId,
        metadata: { reason: 'Invalid TOTP or recovery code during MFA disable attempt' },
      });

      return NextResponse.json(
        { error: 'Invalid authenticator code or recovery code' },
        { status: 401, headers: { [requestIdHeader()]: requestId } }
      );
    }

    // 3. Disable MFA
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false },
    });

    await prisma.mfaDevice.deleteMany({
      where: { userId: user.id },
    });

    await logAuditEvent({
      userId: user.id,
      action: AuditAction.MFA_DISABLED,
      ipAddress,
      userAgent,
      requestId,
      metadata: { email: user.email },
    });

    return NextResponse.json(
      { message: 'MFA has been successfully disabled', enabled: false },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('MFA disable error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error during MFA disable' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
