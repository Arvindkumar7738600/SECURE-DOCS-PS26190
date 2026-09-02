import 'dotenv/config';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM

export interface EncryptedDocumentResult {
  encryptedBuffer: Buffer;
  iv: string;
  authTag: string;
  algorithm: string;
  encryptionVersion: number;
}

export function getDocumentEncryptionKey(): Buffer {
  const rawKey =
    process.env.DOCUMENT_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.ENCRYPTION_MASTER_KEY;

  if (!rawKey) {
    throw new Error(
      'CRITICAL SECURITY ERROR: DOCUMENT_ENCRYPTION_KEY, ENCRYPTION_KEY, or ENCRYPTION_MASTER_KEY is required'
    );
  }

  let keyBuffer: Buffer;
  // If hex string of 64 hex characters (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    keyBuffer = Buffer.from(rawKey, 'hex');
  } else {
    keyBuffer = Buffer.from(rawKey, 'utf-8');
  }

  if (keyBuffer.length !== 32) {
    throw new Error(
      `CRITICAL SECURITY ERROR: DOCUMENT_ENCRYPTION_KEY must be exactly 32 bytes (received ${keyBuffer.length} bytes)`
    );
  }

  return keyBuffer;
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function encryptDocument(plaintextBuffer: Buffer, keyOverride?: Buffer): EncryptedDocumentResult {
  const key = keyOverride || getDocumentEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    algorithm: 'AES-256-GCM',
    encryptionVersion: 1,
  };
}

export function decryptDocument(
  encryptedBuffer: Buffer,
  ivHex: string,
  authTagHex: string,
  keyOverride?: Buffer
): Buffer {
  const key = keyOverride || getDocumentEncryptionKey();

  if (!ivHex || !authTagHex) {
    throw new Error('Decryption Error: IV and authTag are required');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Decryption Error: Invalid IV length (${iv.length} bytes, expected ${IV_LENGTH})`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Decryption Error: Invalid authTag length (${authTag.length} bytes, expected ${AUTH_TAG_LENGTH})`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  } catch (error: any) {
    throw new Error('AES-256-GCM Authentication Failed: Ciphertext, IV, or Auth Tag has been tampered with');
  }
}
