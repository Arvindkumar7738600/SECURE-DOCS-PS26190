import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { list, put } from '@vercel/blob';
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
  storageSource: 'filesystem' | 'vercel-blob';
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
  code:
    | 'INVALID_STORAGE_KEY'
    | 'MISSING_DOCUMENT_STORAGE'
    | 'CORRUPT_DOCUMENT_STORAGE'
    | 'STORAGE_NOT_CONFIGURED';

  constructor(
    message: string,
    code:
      | 'INVALID_STORAGE_KEY'
      | 'MISSING_DOCUMENT_STORAGE'
      | 'CORRUPT_DOCUMENT_STORAGE'
      | 'STORAGE_NOT_CONFIGURED',
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

export function getDocumentStorageRoot(): string {
  if (process.env.DOCUMENT_STORAGE_DIR) {
    return path.resolve(process.env.DOCUMENT_STORAGE_DIR);
  }
  if (process.env.PRIVATE_STORAGE_DIR) {
    return path.resolve(process.env.PRIVATE_STORAGE_DIR);
  }
  // In Vercel serverless functions, process.cwd() (/var/task) is read-only. Fallback to /tmp.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'storage', 'documents');
  }
  return DEFAULT_STORAGE_ROOT;
}

function getBlobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token && token !== 'vercel_blob_rw_dummy_token_for_local_dev' ? token : null;
}

function shouldUseLocalFilesystem(): boolean {
  // An explicit local directory is useful for development and automated tests.
  if (process.env.DOCUMENT_STORAGE_DIR || process.env.PRIVATE_STORAGE_DIR) {
    return !process.env.VERCEL && process.env.NODE_ENV !== 'production';
  }

  return !process.env.VERCEL && process.env.NODE_ENV !== 'production' && !getBlobToken();
}

function assertStorageConfiguration(): 'filesystem' | 'vercel-blob' {
  if (shouldUseLocalFilesystem()) return 'filesystem';
  if (getBlobToken()) return 'vercel-blob';

  throw new DocumentStorageError(
    'Persistent document storage is not configured. Set BLOB_READ_WRITE_TOKEN.',
    'STORAGE_NOT_CONFIGURED'
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  const storageBackend = assertStorageConfiguration();

  if (storageBackend === 'vercel-blob') {
    const token = getBlobToken()!;
    try {
      const result = await list({ prefix: storageKey, limit: 1000, token });
      const blob = result.blobs.find((item) => item.pathname === storageKey);
      if (!blob) {
        throw new DocumentStorageError(
          'Document storage is missing',
          'MISSING_DOCUMENT_STORAGE'
        );
      }

      const response = await fetch(blob.url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Blob download failed with status ${response.status}`);
      }

      return {
        ciphertext: Buffer.from(await response.arrayBuffer()),
        sourcePath: blob.url,
      };
    } catch (error) {
      if (error instanceof DocumentStorageError) throw error;
      throw new DocumentStorageError(
        `Document storage could not be read from Vercel Blob: ${getErrorMessage(error)}`,
        'CORRUPT_DOCUMENT_STORAGE',
        error
      );
    }
  }

  const filePath = resolveStoragePath(storageKey);

  try {
    const ciphertext = await fs.readFile(filePath);
    return { ciphertext, sourcePath: filePath };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      // Check fallback /tmp path
      const tmpFallbackPath = path.resolve(os.tmpdir(), 'storage', 'documents', storageKey);
      try {
        const ciphertext = await fs.readFile(tmpFallbackPath);
        return { ciphertext, sourcePath: tmpFallbackPath };
      } catch (fallbackError: any) {
        throw new DocumentStorageError(
          'Document storage is missing',
          'MISSING_DOCUMENT_STORAGE',
          fallbackError
        );
      }
    }

    throw new DocumentStorageError(
      'Document storage could not be read',
      'CORRUPT_DOCUMENT_STORAGE',
      error
    );
  }
}

export async function storeDocumentCiphertext(storageKey: string, ciphertext: Buffer): Promise<{ sourcePath: string; sha256: string; storageSource: ResolvedDocumentBytes['storageSource'] }> {
  const storageBackend = assertStorageConfiguration();

  if (storageBackend === 'vercel-blob') {
    const token = getBlobToken()!;
    try {
      const blob = await put(storageKey, ciphertext, {
        access: 'public',
        addRandomSuffix: false,
        token,
      });

      return {
        sourcePath: blob.url,
        sha256: calculateSha256(ciphertext),
        storageSource: 'vercel-blob',
      };
    } catch (error) {
      throw new DocumentStorageError(
        `Document could not be persisted to Vercel Blob: ${getErrorMessage(error)}`,
        'CORRUPT_DOCUMENT_STORAGE',
        error
      );
    }
  }

  let filePath = resolveStoragePath(storageKey);
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, ciphertext);
  } catch (err: any) {
    // If writing to default root fails (e.g. read-only filesystem on serverless /var/task), fallback to /tmp
    const fallbackRoot = path.join(os.tmpdir(), 'storage', 'documents');
    filePath = path.resolve(fallbackRoot, storageKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, ciphertext);
  }

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
    sourcePath: result.sourcePath,
    sha256: calculateSha256(plaintext),
    storageSource: result.storageSource,
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
    storageSource: assertStorageConfiguration(),
  };
}

export async function loadDocumentPlaintext(version: DocumentVersionBytesInput): Promise<ResolvedDocumentBytes> {
  const storedBytes = await loadStoredDocumentCiphertext(version.storageKey);

  const shouldDecrypt = version.encryptionAlgorithm?.toUpperCase() === 'AES-256-GCM';

  if (!shouldDecrypt) {
    return storedBytes;
  }

  if (!version.iv || !version.authTag) {
    throw new DocumentStorageError(
      'Encrypted document metadata is incomplete',
      'CORRUPT_DOCUMENT_STORAGE'
    );
  }

  try {
    const plaintext = decryptDocument(
      storedBytes.ciphertext,
      version.iv,
      version.authTag
    );

    return {
      ...storedBytes,
      plaintext,
    };
  } catch (decryptError: any) {
    throw new DocumentStorageError(
      'Document decryption failed or the stored document was tampered with',
      'CORRUPT_DOCUMENT_STORAGE',
      decryptError
    );
  }
}

export async function calculateDocumentSha256(version: DocumentVersionBytesInput): Promise<{ sha256: string; sourcePath: string; storageSource: ResolvedDocumentBytes['storageSource'] }> {
  const resolvedBytes = await loadDocumentPlaintext(version);
  return {
    sha256: calculateSha256(resolvedBytes.plaintext),
    sourcePath: resolvedBytes.sourcePath,
    storageSource: resolvedBytes.storageSource,
  };
}

export async function verifyDocumentIntegrity(
  version: DocumentVersionBytesInput,
  expectedSha256: string
): Promise<DocumentIntegrityResult> {
  // Load and decrypt the document to get the true original plaintext bytes
  const resolvedBytes = await loadDocumentPlaintext(version);

  // Calculate SHA-256 on the decrypted plaintext (matching the original upload hash)
  const computedSha256 = calculateSha256(resolvedBytes.plaintext);
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
