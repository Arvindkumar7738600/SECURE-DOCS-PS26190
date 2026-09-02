import assert from 'assert/strict';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { AuditAction, RoleName } from '@prisma/client';
import { encryptDocument } from '../lib/security/document-encryption';
import { calculateSha256 } from '../lib/security/hash';
import { RegisterSchema } from '../lib/auth/validation';
import { calculateDocumentSha256, verifyDocumentIntegrity } from '../lib/documents/document-bytes';
import { reportAuditWriteFailure } from '../lib/audit/logger';
import { jsonResponseWithRequestId } from '../lib/observability/response';

async function withTempStorage<T>(run: (storageRoot: string) => Promise<T>): Promise<T> {
  const originalStorageDir = process.env.DOCUMENT_STORAGE_DIR;
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'phase19-docs-'));

  try {
    process.env.DOCUMENT_STORAGE_DIR = storageRoot;
    return await run(storageRoot);
  } finally {
    process.env.DOCUMENT_STORAGE_DIR = originalStorageDir;
    await fs.rm(storageRoot, { recursive: true, force: true });
  }
}

function assertHeaderHasRequestId(response: Response, expectedStatus: number): void {
  assert.equal(response.status, expectedStatus);
  assert.equal(response.headers.get('x-request-id'), 'req-19');
}

async function runPhase19ProductionSecurityTests() {
  console.log('🧪 Running Phase 19 Production Security Tests...\n');

  {
    const allowed = RegisterSchema.safeParse({
      email: 'viewer@example.com',
      password: 'Password123!',
      fullName: 'Viewer User',
      department: 'Evidence Review',
    });
    assert.equal(allowed.success, true, 'Public registration should accept the safe default role');

    const privilegedInjection = RegisterSchema.safeParse({
      email: 'admin@example.com',
      password: 'Password123!',
      fullName: 'Admin User',
      department: 'Evidence Review',
      role: RoleName.ADMIN,
    });
    assert.equal(privilegedInjection.success, false, 'Privileged role injection must be rejected');
    console.log('✅ Registration role injection is rejected');
  }

  await withTempStorage(async (storageRoot) => {
    const storageKey = 'cases/case-19/documents/doc-19/versions/1/source';
    const filePath = path.join(storageRoot, storageKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const plaintext = Buffer.from('phase 19 confidential evidence packet');
    const encryptionKey = crypto.randomBytes(32);
    const originalDocumentKey = process.env.DOCUMENT_ENCRYPTION_KEY;
    process.env.DOCUMENT_ENCRYPTION_KEY = encryptionKey.toString('hex');

    try {
      const encrypted = encryptDocument(plaintext);
      await fs.writeFile(filePath, encrypted.encryptedBuffer);

      const expectedPlaintextHash = calculateSha256(plaintext);

      const integrityResult = await verifyDocumentIntegrity(
        {
          storageKey,
          encryptionAlgorithm: encrypted.algorithm,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        },
        expectedPlaintextHash
      );

      const serverHash = await calculateDocumentSha256({
        storageKey,
        encryptionAlgorithm: encrypted.algorithm,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      });

      assert.equal(integrityResult.status, 'VERIFIED', 'Server-side hash should match the original plaintext');
      assert.equal(integrityResult.computedSha256, expectedPlaintextHash);
      assert.equal(serverHash.sha256, expectedPlaintextHash);
      console.log('✅ Document hash is computed from original plaintext');

      const tamperedCiphertext = Buffer.from(encrypted.encryptedBuffer);
      tamperedCiphertext[0] = tamperedCiphertext[0] ^ 0xff;
      await fs.writeFile(filePath, tamperedCiphertext);

      await assert.rejects(
        () =>
          verifyDocumentIntegrity(
            {
              storageKey,
              encryptionAlgorithm: encrypted.algorithm,
              iv: encrypted.iv,
              authTag: encrypted.authTag,
            },
            expectedPlaintextHash
          ),
        /decryption failed|Authentication Failed|tampered/i
      );
      console.log('✅ Tampered ciphertext is rejected by GCM authentication');
    } finally {
      process.env.DOCUMENT_ENCRYPTION_KEY = originalDocumentKey;
    }
  });

  {
    const captured: string[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      captured.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
    };

    try {
      reportAuditWriteFailure(new Error('database unavailable'), {
        action: AuditAction.UPLOAD_DOCUMENT,
        userId: 'user-19',
        caseId: 'case-19',
        documentId: 'doc-19',
        requestId: 'req-19',
      });
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(captured.length > 0, true, 'Audit failures must be logged');
    assert.equal(captured.some((line) => line.includes('req-19')), true, 'Audit log output should retain the request ID');
    assert.equal(captured.some((line) => line.includes('Failed to write audit log entry')), true, 'Audit log output should be explicit');
    console.log('✅ Audit write failures are observable with request correlation');
  }

  {
    const unauthorized = jsonResponseWithRequestId({ error: 'Unauthorized' }, 401, 'req-19');
    const notFound = jsonResponseWithRequestId({ error: 'Not found' }, 404, 'req-19');
    const serverError = jsonResponseWithRequestId({ error: 'Internal server error' }, 500, 'req-19');

    assertHeaderHasRequestId(unauthorized, 401);
    assertHeaderHasRequestId(notFound, 404);
    assertHeaderHasRequestId(serverError, 500);
    console.log('✅ Representative document error responses include x-request-id');
  }

  console.log('\n🎉 ALL PHASE 19 PRODUCTION SECURITY TESTS PASSED CLEANLY!');
}

runPhase19ProductionSecurityTests().catch((error) => {
  console.error('❌ Phase 19 production security test failure:', error);
  process.exit(1);
});
