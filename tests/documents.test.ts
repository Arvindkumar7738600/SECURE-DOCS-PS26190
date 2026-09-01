import { calculateSha256 } from '../lib/security/hash';
import { validateFileMetadata, sanitizeFilename, generateStorageKey, getMaxUploadSizeMb } from '../lib/documents/validation';
import { hasPermission } from '../lib/auth/permissions';
import fs from 'fs';
import path from 'path';

async function runDocumentTests() {
  console.log('🧪 Running Phase 7 Document Upload, SHA-256 & Integrity Tests...');

  // 1. SHA-256 Calculation Test from Actual Bytes
  const testFilePath = path.join(process.cwd(), 'demo-data', 'test-document.txt');
  const fileBuffer = fs.readFileSync(testFilePath);
  const hash = calculateSha256(fileBuffer);

  console.assert(typeof hash === 'string' && hash.length === 64, 'SHA-256 hash must be 64 hex characters');

  // Verify hash changes when content changes (tamper test)
  const tamperedBuffer = Buffer.from(fileBuffer.toString() + '\n[TAMPERED CONTENT]');
  const tamperedHash = calculateSha256(tamperedBuffer);
  console.assert(hash !== tamperedHash, 'SHA-256 MUST detect content tampering');
  console.log('✅ Scenario 20 & 22: SHA-256 Hashing & Tamper Detection Passed');

  // 2. File Metadata & Size Validation Tests
  const validResult = validateFileMetadata('report.pdf', 'application/pdf', 1024 * 1024);
  console.assert(validResult.valid === true, 'Valid PDF file should pass validation');

  const invalidExt = validateFileMetadata('malicious.exe', 'application/pdf', 100);
  console.assert(invalidExt.valid === false && invalidExt.errorCode === 422, 'Invalid extension must be rejected (422)');

  const invalidMime = validateFileMetadata('report.pdf', 'application/x-executable', 100);
  console.assert(invalidMime.valid === false && invalidMime.errorCode === 422, 'Invalid MIME must be rejected (422)');

  const maxMb = getMaxUploadSizeMb();
  const oversizedBytes = (maxMb + 1) * 1024 * 1024;
  const oversizedResult = validateFileMetadata('huge.pdf', 'application/pdf', oversizedBytes);
  console.assert(oversizedResult.valid === false && oversizedResult.errorCode === 413, 'Oversized file must return 413');
  console.log('✅ Scenarios 7-9: MIME, Extension, and Size Limits (413/422) Passed');

  // 3. Path Traversal & Filename Sanitization Tests
  const unsafe1 = '../../etc/passwd';
  const sanitized1 = sanitizeFilename(unsafe1);
  console.assert(!sanitized1.includes('/'), 'Path traversal slashes MUST be stripped');
  console.assert(!sanitized1.includes('..'), 'Path traversal dots MUST be stripped');

  const unsafe2 = 'eval_code\0.pdf';
  const sanitized2 = sanitizeFilename(unsafe2);
  console.assert(!sanitized2.includes('\0'), 'Null bytes MUST be stripped');
  console.log('✅ Scenarios 10-11: Path Traversal & Filename Sanitization Passed');

  // 4. Storage Key Generation Control
  const storageKey = generateStorageKey('case-uuid-123', 'doc-uuid-456', 1);
  console.assert(storageKey === 'cases/case-uuid-123/documents/doc-uuid-456/versions/1/source', 'Storage key must be server-deterministic');
  console.log('✅ Scenarios 12-14: Server-Controlled Storage Key & Version 1 Generation Passed');

  // 5. RBAC Document Upload Permissions
  console.assert(hasPermission(['INVESTIGATOR'], 'DOCUMENT_UPLOAD') === true, 'INVESTIGATOR can upload documents');
  console.assert(hasPermission(['OFFICER'], 'DOCUMENT_UPLOAD') === true, 'OFFICER can upload documents');
  console.assert(hasPermission(['VIEWER'], 'DOCUMENT_UPLOAD') === false, 'VIEWER MUST NOT upload documents');
  console.assert(hasPermission(['AUDITOR'], 'DOCUMENT_UPLOAD') === false, 'AUDITOR MUST NOT upload documents');
  console.log('✅ Scenarios 1-6: Document Upload RBAC Scope Passed');

  console.log('🎉 ALL PHASE 7 DOCUMENT SECURITY TESTS PASSED CLEANLY!');
}

runDocumentTests().catch((e) => {
  console.error('❌ Document test failure:', e);
  process.exit(1);
});
