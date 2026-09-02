import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { get, list, put } from '@vercel/blob';
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

function getBlobStoreId(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN_STORE_ID?.trim() || undefined;
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

function getBlobReferences(storageKey: string): string[] {
  const references = [normalizeStoragePath(storageKey), storageKey];

  try {
    const url = new URL(storageKey);
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (pathname && pathname !== storageKey) references.push(pathname);
  } catch {
    // The database normally stores a pathname, not a URL.
  }

  return [...new Set(references)];
}

export function normalizeStoragePath(storageKey: string): string {
  if (!storageKey) {
    throw new DocumentStorageError('Document storage key is required', 'INVALID_STORAGE_KEY');
  }

  try {
    const url = new URL(storageKey);
    return decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    return storageKey.replace(/^\/+/, '');
  }
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
  const canonicalStorageKey = normalizeStoragePath(storageKey);
  const storageBackend = assertStorageConfiguration();

  if (storageBackend === 'vercel-blob') {
    const token = getBlobToken()!;
    const storeId = getBlobStoreId();
    try {
      const tryGetBlob = async (reference: string, access: 'private' | 'public') => {
        try {
          return await get(reference, {
            access,
            storeId,
            token,
            useCache: false,
          });
        } catch {
          // A legacy blob may reject the current store access mode; try the
          // next representation before reporting the document as missing.
          return null;
        }
      };

      // Resolve by pathname first. This avoids relying on list pagination and
      // supports records that already contain a full Blob URL.
      for (const reference of getBlobReferences(storageKey)) {
        const privateBlob = await tryGetBlob(reference, 'private');

        if (privateBlob?.statusCode === 200 && privateBlob.stream) {
          return {
            ciphertext: Buffer.from(await new Response(privateBlob.stream).arrayBuffer()),
            sourcePath: privateBlob.blob.url,
          };
        }
      }

      // Compatibility path for blobs created while the store was public.
      for (const reference of getBlobReferences(storageKey)) {
        const publicBlob = await tryGetBlob(reference, 'public');

        if (publicBlob?.statusCode === 200 && publicBlob.stream) {
          return {
            ciphertext: Buffer.from(await new Response(publicBlob.stream).arrayBuffer()),
            sourcePath: publicBlob.blob.url,
          };
        }
      }

      // Last-resort lookup handles legacy pathname/URL representation changes.
      // Do not limit this to the stored prefix: that prefix may be the value
      // that changed during a storage migration.
      const allBlobs = [] as Awaited<ReturnType<typeof list>>['blobs'];
      let cursor: string | undefined;
      do {
        const result = await list({ prefix: 'cases/', limit: 1000, cursor, storeId, token });
        allBlobs.push(...result.blobs);
        cursor = result.hasMore ? result.cursor : undefined;
      } while (cursor);

      const references = new Set(getBlobReferences(storageKey));
      const exactMatches = allBlobs.filter(
        (item) => references.has(item.pathname) || references.has(item.url)
      );

      const documentMatch = canonicalStorageKey.match(
        /(?:^|\/)documents\/([^/]+)(?:\/versions\/([^/]+))?(?:\/|$)/
      );
      const documentId = documentMatch?.[1];
      const versionNumber = documentMatch?.[2];
      const documentMatches = allBlobs.filter((item) => {
        const pathname = normalizeStoragePath(item.pathname);
        return Boolean(
          documentId &&
          pathname.includes(`/documents/${documentId}/`) &&
          (!versionNumber || pathname.includes(`/versions/${versionNumber}/`))
        );
      });

      const filename = path.basename(canonicalStorageKey);
      const filenameMatches = allBlobs.filter((item) =>
        normalizeStoragePath(item.pathname).endsWith(`/${filename}`)
      );
      const matches = exactMatches.length > 0
        ? exactMatches
        : documentMatches.length > 0
          ? documentMatches
          : filenameMatches.length === 1
            ? filenameMatches
            : [];
      const blob = matches[0];
      if (!blob) {
        throw new DocumentStorageError(
          `Document storage is missing for "${canonicalStorageKey}"`,
          'MISSING_DOCUMENT_STORAGE'
        );
      }

      const legacyBlob = await tryGetBlob(blob.url, 'public');
      if (!legacyBlob || legacyBlob.statusCode !== 200 || !legacyBlob.stream) {
        throw new Error('Blob lookup found metadata but returned no document content');
      }

      return {
        ciphertext: Buffer.from(await new Response(legacyBlob.stream).arrayBuffer()),
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

  const filePath = resolveStoragePath(canonicalStorageKey);

  try {
    const ciphertext = await fs.readFile(filePath);
    return { ciphertext, sourcePath: filePath };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      // Check fallback /tmp path
      const tmpFallbackPath = path.resolve(os.tmpdir(), 'storage', 'documents', canonicalStorageKey);
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

export async function storeDocumentCiphertext(storageKey: string, ciphertext: Buffer): Promise<{ storageKey: string; sourcePath: string; sha256: string; storageSource: ResolvedDocumentBytes['storageSource'] }> {
  const canonicalStorageKey = normalizeStoragePath(storageKey);
  const storageBackend = assertStorageConfiguration();

  if (storageBackend === 'vercel-blob') {
    const token = getBlobToken()!;
    const storeId = getBlobStoreId();
    try {
      const blob = await put(canonicalStorageKey, ciphertext, {
        access: 'private',
        storeId,
        addRandomSuffix: false,
        contentType: 'application/octet-stream',
        token,
      });

      if (blob.pathname !== canonicalStorageKey) {
        throw new Error(
          `Blob pathname mismatch: requested "${canonicalStorageKey}", received "${blob.pathname}"`
        );
      }

      return {
        storageKey: blob.pathname,
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

  let filePath = resolveStoragePath(canonicalStorageKey);
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, ciphertext);
  } catch (err: any) {
    // If writing to default root fails (e.g. read-only filesystem on serverless /var/task), fallback to /tmp
    const fallbackRoot = path.join(os.tmpdir(), 'storage', 'documents');
    filePath = path.resolve(fallbackRoot, canonicalStorageKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, ciphertext);
  }

  return {
    storageKey: canonicalStorageKey,
    sourcePath: filePath,
    sha256: calculateSha256(ciphertext),
    storageSource: 'filesystem',
  };
}

export async function storeEncryptedDocumentPlaintext(
  storageKey: string,
  plaintext: Buffer
): Promise<{
  storageKey: string;
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
    storageKey: result.storageKey,
    sourcePath: result.sourcePath,
    sha256: calculateSha256(plaintext),
    storageSource: result.storageSource,
    encryptionAlgorithm: encrypted.algorithm,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
  };
}

export async function loadStoredDocumentCiphertext(storageKey: string): Promise<ResolvedDocumentBytes> {
  const canonicalStorageKey = normalizeStoragePath(storageKey);
  const stored = await readStoredBytes(canonicalStorageKey);
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
