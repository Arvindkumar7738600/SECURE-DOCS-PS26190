import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  // Strict check: No hardcoded unsafe keys. Must come from Vercel env.
  const envKey = process.env.ENCRYPTION_KEY || process.env.DOCUMENT_ENCRYPTION_KEY;

  if (!envKey) {
    throw new Error('CRITICAL SECURITY ERROR: ENCRYPTION_KEY or DOCUMENT_ENCRYPTION_KEY is missing in environment variables.');
  }

  // If provided as a 64-character hex string (32 bytes)
  if (envKey.length === 64) {
    return Buffer.from(envKey, 'hex');
  }

  // Otherwise, derive a strict 32-byte key via SHA-256
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Encrypts raw binary buffers (Files, PDFs, Images) securely.
 */
export function encryptBuffer(buffer: Buffer): { encryptedData: string; iv: string; authTag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard IV length for AES-GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString('base64'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts encrypted payload back to original binary buffer.
 */
export function decryptBuffer(encryptedBase64: string, ivHex: string, authTagHex: string): Buffer {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted;
}

/**
 * Encrypts standard text fields.
 */
export function encryptText(text: string): string {
  const buffer = Buffer.from(text, 'utf8');
  const { encryptedData, iv, authTag } = encryptBuffer(buffer);
  return `${iv}:${authTag}:${encryptedData}`;
}

/**
 * Decrypts standard text fields.
 */
export function decryptText(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }
  const [iv, authTag, encryptedData] = parts;
  const decryptedBuffer = decryptBuffer(encryptedData, iv, authTag);
  return decryptedBuffer.toString('utf8');
}