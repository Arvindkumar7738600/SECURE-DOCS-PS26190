import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { verifyMfaChallengeToken, signJWT } from '@/lib/security/jwt';
import { decryptText } from '@/lib/security/encryption';
import { verifyTotpCode, generateRecoveryCodes, hashRecoveryCode } from '@/lib/auth/mfa';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const rateLimitResult = checkRateLimit(`mfa:${ipAddress}`, 10, 15 * 60 * 1000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many MFA attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)), [requestIdHeader()]: requestId } }
    );
  }

  try {
    const body = await req.json();
    const { totpCode, recoveryCode, challengeToken } = body;

    if (!totpCode && !recoveryCode) {
      return NextResponse.json(
        { error: 'Either totpCode or recoveryCode is required' },
        { status: 400, headers: { [requestIdHeader()]: requestId } }
      );
    }

    // -------------------------------------------------------------
    // CASE A: Login Challenge Verification (using challengeToken)
    // -------------------------------------------------------------
    if (challengeToken) {
      const challenge = await verifyMfaChallengeToken(challengeToken);
      if (!challenge) {
        return NextResponse.json(
          { error: 'Invalid or expired MFA challenge token' },
          { status: 401, headers: { [requestIdHeader()]: requestId } }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: challenge.sub },
        include: {
          mfaDevices: true,
          userRoles: { include: { role: true } },
        },
      });

      if (!user || !user.isActive || !user.mfaEnabled || user.mfaDevices.length === 0) {
        await logAuditEvent({
          userId: challenge.sub,
          action: AuditAction.MFA_FAILED,
          ipAddress,
          userAgent,
          requestId,
          metadata: { reason: 'User inactive or MFA device missing' },
        });

        return NextResponse.json(
          { error: 'MFA verification failed' },
          { status: 401, headers: { [requestIdHeader()]: requestId } }
        );
      }

      const mfaDevice = user.mfaDevices[0];
      const rawSecret = decryptText(mfaDevice.secretEncrypted);
      let isVerifiedSuccess = false;
      let usedRecoveryCode = false;

      // 1. Verify TOTP
      if (totpCode) {
        isVerifiedSuccess = verifyTotpCode(totpCode, rawSecret);
      }

      // 2. Verify Recovery Code if TOTP failed or omitted
      if (!isVerifiedSuccess && recoveryCode) {
        const inputHash = hashRecoveryCode(recoveryCode);
        const storedCodes = (mfaDevice.recoveryCodes as { codeHash: string; used: boolean }[]) || [];

        const codeIndex = storedCodes.findIndex((rc) => rc.codeHash === inputHash && !rc.used);

        if (codeIndex !== -1) {
          isVerifiedSuccess = true;
          usedRecoveryCode = true;
          // Mark recovery code as used
          storedCodes[codeIndex].used = true;

          await prisma.mfaDevice.update({
            where: { id: mfaDevice.id },
            data: {
              recoveryCodes: storedCodes,
              lastUsedAt: new Date(),
            },
          });
        }
      }

      if (!isVerifiedSuccess) {
        await logAuditEvent({
          userId: user.id,
          action: AuditAction.MFA_FAILED,
          ipAddress,
          userAgent,
          requestId,
          metadata: { reason: 'Invalid TOTP or recovery code' },
        });

        return NextResponse.json(
          { error: 'Invalid authenticator code or recovery code' },
          { status: 401, headers: { [requestIdHeader()]: requestId } }
        );
      }

      // Audit Success
      const roles = user.userRoles.map((ur) => ur.role.name);
      await logAuditEvent({
        userId: user.id,
        action: usedRecoveryCode ? AuditAction.MFA_RECOVERY_USED : AuditAction.MFA_VERIFIED,
        ipAddress,
        userAgent,
        requestId,
        metadata: { email: user.email, usedRecoveryCode },
      });

      // Issue Final Session Token
      const token = await signJWT({
        sub: user.id,
        email: user.email,
        roles,
      });

      const response = NextResponse.json(
        {
          message: 'MFA verification successful',
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
    }

    // -------------------------------------------------------------
    // CASE B: Authenticated User Setup Verification (Enable MFA)
    // -------------------------------------------------------------
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthenticated' },
        { status: 401, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const device = await prisma.mfaDevice.findFirst({
      where: { userId: currentUser.id },
    });

    if (!device) {
      return NextResponse.json(
        { error: 'No MFA setup found. Please call /api/v1/auth/mfa/setup first.' },
        { status: 404, headers: { [requestIdHeader()]: requestId } }
      );
    }

    const secret = decryptText(device.secretEncrypted);
    const isValid = totpCode ? verifyTotpCode(totpCode, secret) : false;

    if (!isValid) {
      await logAuditEvent({
        userId: currentUser.id,
        action: AuditAction.MFA_FAILED,
        ipAddress,
        userAgent,
        requestId,
        metadata: { reason: 'Invalid TOTP during setup verification' },
      });

      return NextResponse.json(
        { error: 'Invalid authenticator verification code' },
        { status: 400, headers: { [requestIdHeader()]: requestId } }
      );
    }

    // Generate Recovery Codes
    const { plain: recoveryCodesPlain, hashed: recoveryCodesHashed } = generateRecoveryCodes();

    // Enable MFA
    await prisma.mfaDevice.update({
      where: { id: device.id },
      data: {
        isVerified: true,
        recoveryCodes: recoveryCodesHashed,
      },
    });

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { mfaEnabled: true },
    });

    await logAuditEvent({
      userId: currentUser.id,
      action: AuditAction.MFA_ENABLED,
      ipAddress,
      userAgent,
      requestId,
      metadata: { email: currentUser.email },
    });

    return NextResponse.json(
      {
        message: 'MFA enabled successfully',
        enabled: true,
        recoveryCodes: recoveryCodesPlain,
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('MFA verify error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error during MFA verification' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
