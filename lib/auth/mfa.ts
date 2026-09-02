import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

authenticator.options = {
  window: 1, // Allow 30-second clock drift
};

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function generateOtpAuthUri(email: string, secret: string): string {
  return authenticator.keyuri(email, 'SecureCaseRepo_SIH2026', secret);
}

export async function generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyTotpCode(code: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: code.trim(), secret });
  } catch (err) {
    return false;
  }
}

export function generateRecoveryCodes(): {
  plain: string[];
  hashed: { codeHash: string; used: boolean }[];
} {
  const plain: string[] = [];
  const hashed: { codeHash: string; used: boolean }[] = [];

  for (let i = 0; i < 8; i++) {
    const bytes = crypto.randomBytes(6).toString('hex').toUpperCase();
    const formatted = `${bytes.slice(0, 4)}-${bytes.slice(4, 8)}-${bytes.slice(8, 12)}`;
    const codeHash = crypto.createHash('sha256').update(formatted).digest('hex');

    plain.push(formatted);
    hashed.push({ codeHash, used: false });
  }

  return { plain, hashed };
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}
