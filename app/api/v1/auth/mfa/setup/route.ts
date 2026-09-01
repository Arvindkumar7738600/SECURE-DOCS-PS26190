import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { generateTotpSecret, generateOtpAuthUri, generateQrCodeDataUrl } from '@/lib/auth/mfa';
import { encryptText } from '@/lib/security/encryption';
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

    // Generate fresh TOTP secret
    const secret = generateTotpSecret();
    const encryptedSecret = encryptText(secret);
    const otpauthUrl = generateOtpAuthUri(user.email, secret);
    const qrCodeUrl = await generateQrCodeDataUrl(otpauthUrl);

    // Upsert unverified MFA Device
    const existingDevice = await prisma.mfaDevice.findFirst({
      where: { userId: user.id },
    });

    if (existingDevice) {
      await prisma.mfaDevice.update({
        where: { id: existingDevice.id },
        data: {
          secretEncrypted: encryptedSecret,
          isVerified: false,
        },
      });
    } else {
      await prisma.mfaDevice.create({
        data: {
          userId: user.id,
          secretEncrypted: encryptedSecret,
          isVerified: false,
        },
      });
    }

    await logAuditEvent({
      userId: user.id,
      action: AuditAction.MFA_SETUP,
      ipAddress,
      userAgent,
      requestId,
      metadata: { email: user.email },
    });

    return NextResponse.json(
      {
        message: 'MFA setup initialized. Scan the QR code with your authenticator app and verify.',
        secret,
        qrCodeUrl,
        otpauthUrl,
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('MFA setup error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error during MFA setup' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
