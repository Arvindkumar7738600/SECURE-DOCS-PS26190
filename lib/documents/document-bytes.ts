import fs from 'fs/promises';
import path from 'path';
import { encryptDocument, decryptDocument } from '@/lib/security/document-encryption';
import { calculateSha256 } from '@/lib/security/hash';

export interface DocumentVersionBytesInput {
  storageKey: string;
  encryptionAlgorithm?: string | null;
  iv?: string | null;
  authTag?: string | null;
}

export interface ResolvedDocumentBytes {
  ciphertext: Buffer;
  plaintext: Buffer;
  sourcePath: string;
  storageSource: 'filesystem';
}

export interface DocumentIntegrityResult {
  status: 'VERIFIED' | 'MISMATCH' | 'TAMPER_DETECTED';
  expectedSha256: string;
  computedSha256: string | null;
  sourcePath: string;
  storageSource: ResolvedDocumentBytes['storageSource'];
  message: string;
}

export class DocumentStorageError extends Error {
  code: 'INVALID_STORAGE_KEY' | 'MISSING_DOCUMENT_STORAGE' | 'CORRUPT_DOCUMENT_STORAGE';

  constructor(
    message: string,
    code: 'INVALID_STORAGE_KEY' | 'MISSING_DOCUMENT_STORAGE' | 'CORRUPT_DOCUMENT_STORAGE',
    cause?: unknown
  ) {
    super(message);
    this.name = 'DocumentStorageError';
    this.code = code;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), 'storage', 'documents');
const ZERO_IV = '000000000000000000000000';
const ZERO_AUTH_TAG = '00000000000000000000000000000000';

export function getDocumentStorageRoot(): string {
  return path.resolve(
    process.env.DOCUMENT_STORAGE_DIR ||
      process.env.PRIVATE_STORAGE_DIR ||
      DEFAULT_STORAGE_ROOT
  );
}

function resolveStoragePath(storageKey: string): string {
  if (!storageKey) {
    throw new DocumentStorageError('Document storage key is required', 'INVALID_STORAGE_KEY');
  }

  const storageRoot = getDocumentStorageRoot();
  const candidatePath = path.resolve(storageRoot, storageKey);
  const relativePath = path.relative(storageRoot, candidatePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new DocumentStorageError('Document storage key resolves outside the storage root', 'INVALID_STORAGE_KEY');
  }

  return candidatePath;
}

async function readStoredBytes(storageKey: string): Promise<{ ciphertext: Buffer; sourcePath: string }> {
  const filePath = resolveStoragePath(storageKey);

  try {
    const ciphertext = await fs.readFile(filePath);
    return { ciphertext, sourcePath: filePath };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new DocumentStorageError(
        `Document bytes are missing from storage for key ${storageKey}`,
        'MISSING_DOCUMENT_STORAGE',
        error
      );
    }

    throw new DocumentStorageError(
      `Document bytes could not be read for key ${storageKey}`,
      'CORRUPT_DOCUMENT_STORAGE',
      error
    );
  }
}

export async function storeDocumentCiphertext(storageKey: string, ciphertext: Buffer): Promise<{ sourcePath: string; sha256: string; storageSource: ResolvedDocumentBytes['storageSource'] }> {
  const filePath = resolveStoragePath(storageKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, ciphertext);
  return {
    sourcePath: filePath,
    sha256: calculateSha256(ciphertext),
    storageSource: 'filesystem',
  };
}

export async function storeEncryptedDocumentPlaintext(
  storageKey: string,
  plaintext: Buffer
): Promise<{
  sourcePath: string;
  sha256: string;
  storageSource: ResolvedDocumentBytes['storageSource'];
  encryptionAlgorithm: string;
  iv: string;
  authTag: string;
}> {
  const encrypted = encryptDocument(plaintext);
  const result = await storeDocumentCiphertext(storageKey, encrypted.encryptedBuffer);
  return {
    ...result,
    encryptionAlgorithm: encrypted.algorithm,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
  };
}

export async function loadStoredDocumentCiphertext(storageKey: string): Promise<ResolvedDocumentBytes> {
  const stored = await readStoredBytes(storageKey);
  return {
    ciphertext: stored.ciphertext,
    plaintext: stored.ciphertext,
    sourcePath: stored.sourcePath,
    storageSource: 'filesystem',
  };
}

export async function loadDocumentPlaintext(version: DocumentVersionBytesInput): Promise<ResolvedDocumentBytes> {
  const storedBytes = await loadStoredDocumentCiphertext(version.storageKey);

  const shouldDecrypt =
    version.encryptionAlgorithm === 'AES-256-GCM' &&
    version.iv !== undefined &&
    version.authTag !== undefined &&
    version.iv !== ZERO_IV &&
    version.authTag !== ZERO_AUTH_TAG;

  if (!shouldDecrypt) {
    return storedBytes;
  }

  const plaintext = decryptDocument(
    storedBytes.ciphertext,
    version.iv || ZERO_IV,
    version.authTag || ZERO_AUTH_TAG
  );

  return {
    ...storedBytes,
    plaintext,
  };
}

export async function calculateDocumentSha256(version: DocumentVersionBytesInput): Promise<{ sha256: string; sourcePath: string; storageSource: ResolvedDocumentBytes['storageSource'] }> {
  const resolvedBytes = await loadStoredDocumentCiphertext(version.storageKey);
  return {
    sha256: calculateSha256(resolvedBytes.ciphertext),
    sourcePath: resolvedBytes.sourcePath,
    storageSource: resolvedBytes.storageSource,
  };
}

export async function verifyDocumentIntegrity(
  version: DocumentVersionBytesInput,
  expectedSha256: string
): Promise<DocumentIntegrityResult> {
  const resolvedBytes = await loadStoredDocumentCiphertext(version.storageKey);
  const computedSha256 = calculateSha256(resolvedBytes.ciphertext);
  const normalizedExpected = expectedSha256.toLowerCase();
  const status = computedSha256 === normalizedExpected ? 'VERIFIED' : 'MISMATCH';

  return {
    status,
    expectedSha256: normalizedExpected,
    computedSha256,
    sourcePath: resolvedBytes.sourcePath,
    storageSource: resolvedBytes.storageSource,
    message:
      status === 'VERIFIED'
        ? 'Document SHA-256 integrity verified successfully'
        : 'WARNING: Document tamper detected! Stored hash does not match computed content hash.',
  };
}
