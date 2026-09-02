import assert from 'assert/strict';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  calculateDocumentSha256,
  loadDocumentPlaintext,
  storeEncryptedDocumentPlaintext,
  verifyDocumentIntegrity,
  DocumentStorageError,
} from '../lib/documents/document-bytes';

async function withTempDocumentStorage<T>(run: (storageRoot: string) => Promise<T>): Promise<T> {
  const originalStorageDir = process.env.DOCUMENT_STORAGE_DIR;
  const originalEncryptionKey = process.env.DOCUMENT_ENCRYPTION_KEY;
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'phase20-storage-'));
  const encryptionKey = crypto.randomBytes(32).toString('hex');

  try {
    process.env.DOCUMENT_STORAGE_DIR = storageRoot;
    process.env.DOCUMENT_ENCRYPTION_KEY = encryptionKey;
    return await run(storageRoot);
  } finally {
    process.env.DOCUMENT_STORAGE_DIR = originalStorageDir;
    process.env.DOCUMENT_ENCRYPTION_KEY = originalEncryptionKey;
    await fs.rm(storageRoot, { recursive: true, force: true });
  }
}

async function runPhase20DocumentStorageTests() {
  console.log('🧪 Running Phase 20 Document Storage Tests...\n');

  await withTempDocumentStorage(async (storageRoot) => {
    const storageKey = 'cases/case-20/documents/doc-20/versions/1/source';
    const plaintext = Buffer.from('phase 20 evidence payload - canonical storage');

    const uploadResult = await storeEncryptedDocumentPlaintext(storageKey, plaintext);
    const storedPath = path.join(storageRoot, storageKey);

    assert.equal(uploadResult.storageSource, 'filesystem', 'Upload should persist to filesystem storage');
    assert.equal(await fs.readFile(storedPath).then((buffer) => buffer.length > 0), true, 'Stored bytes must exist on disk');

    const storedHash = await calculateDocumentSha256({
      storageKey,
      encryptionAlgorithm: uploadResult.encryptionAlgorithm,
      iv: uploadResult.iv,
      authTag: uploadResult.authTag,
    });
    assert.equal(uploadResult.sha256, storedHash.sha256, 'Persisted hash should be based on original plaintext bytes');

    const downloaded = await loadDocumentPlaintext({
      storageKey,
      encryptionAlgorithm: uploadResult.encryptionAlgorithm,
      iv: uploadResult.iv,
      authTag: uploadResult.authTag,
    });

    assert.equal(downloaded.plaintext.toString(), plaintext.toString(), 'Download should return the original plaintext bytes');

    const integrity = await verifyDocumentIntegrity(
      {
        storageKey,
        encryptionAlgorithm: uploadResult.encryptionAlgorithm,
        iv: uploadResult.iv,
        authTag: uploadResult.authTag,
      },
      storedHash.sha256
    );

    assert.equal(integrity.status, 'VERIFIED', 'Integrity verification should succeed against stored bytes');
    console.log('✅ Upload -> storage -> download -> hash verification passed');

    await fs.unlink(storedPath);
    await assert.rejects(
      () =>
        calculateDocumentSha256({
          storageKey,
          encryptionAlgorithm: uploadResult.encryptionAlgorithm,
          iv: uploadResult.iv,
          authTag: uploadResult.authTag,
        }),
      (error: unknown) => error instanceof DocumentStorageError && error.code === 'MISSING_DOCUMENT_STORAGE'
    );
    console.log('✅ Missing document storage fails safely');

    const tamperUpload = await storeEncryptedDocumentPlaintext(storageKey, plaintext);
    const tamperPath = path.join(storageRoot, storageKey);
    const tamperedBytes = await fs.readFile(tamperPath);
    tamperedBytes[0] = tamperedBytes[0] ^ 0xff;
    await fs.writeFile(tamperPath, tamperedBytes);

    await assert.rejects(
      () =>
        verifyDocumentIntegrity(
          {
            storageKey,
            encryptionAlgorithm: tamperUpload.encryptionAlgorithm,
            iv: tamperUpload.iv,
            authTag: tamperUpload.authTag,
          },
          tamperUpload.sha256
        ),
      /decryption failed|Authentication Failed|tampered/i
    );
    await assert.rejects(
      () =>
        loadDocumentPlaintext({
          storageKey,
          encryptionAlgorithm: tamperUpload.encryptionAlgorithm,
          iv: tamperUpload.iv,
          authTag: tamperUpload.authTag,
        }),
      /Authentication Failed|tampered/i
    );
    console.log('✅ Tampered document storage is detected');
  });

  console.log('\n🎉 ALL PHASE 20 DOCUMENT STORAGE TESTS PASSED CLEANLY!');
}

runPhase20DocumentStorageTests().catch((error) => {
  console.error('❌ Phase 20 document storage test failure:', error);
  process.exit(1);
});
