import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY_HEX = '636173655f6d616e6167656d656e745f7365637265745f6b65795f323032363038323830';

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY || DEFAULT_KEY_HEX;
  if (envKey.length === 64) {
    return Buffer.from(envKey, 'hex');
  }
  // Fallback: derive 32-byte key using SHA-256 of envKey string
  return crypto.createHash('sha256').update(envKey).digest();
}

export interface EncryptedPayload {
  encrypted: string; // base64
  iv: string;        // hex
  authTag: string;   // hex
}

export function encryptText(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Format as iv:authTag:encrypted for single-string database persistence
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptText(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
