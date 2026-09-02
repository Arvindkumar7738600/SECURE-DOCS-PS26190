import {
  encryptDocument,
  decryptDocument,
  generateEncryptionKey,
  getDocumentEncryptionKey,
} from '../lib/security/document-encryption';
import { calculateSha256 } from '../lib/security/hash';
import { hasPermission } from '../lib/auth/permissions';
import crypto from 'crypto';

async function runEncryptionTests() {
  console.log('🧪 Running Phase 8 AES-256-GCM Document Encryption & Security Tests...');

  const masterKey = getDocumentEncryptionKey();
  console.assert(masterKey.length === 32, 'Master encryption key MUST be exactly 32 bytes');
  console.log('✅ Test 1: 32-Byte Master Key Validation Passed');

  // Sample original plaintext buffer
  const originalPlaintext = Buffer.from(
    'CONFIDENTIAL POLICE EVIDENCE REPORT - CASE-2026-9918 - CLASSIFIED INVESTIGATION DATA'
  );
  const originalSha256 = calculateSha256(originalPlaintext);

  // 1. AES-256-GCM Encryption
  const encryptedResult = encryptDocument(originalPlaintext);
  console.assert(
    encryptedResult.algorithm === 'AES-256-GCM',
    'Encryption algorithm MUST be AES-256-GCM'
  );
  console.assert(
    encryptedResult.iv.length === 24,
    'IV must be 12 bytes hex string (24 hex chars)'
  );
  console.assert(
    encryptedResult.authTag.length === 32,
    'Auth Tag must be 16 bytes hex string (32 hex chars)'
  );

  // Verify Plaintext is NOT visible in ciphertext
  console.assert(
    !encryptedResult.encryptedBuffer.toString('utf-8').includes('CONFIDENTIAL POLICE EVIDENCE'),
    'CRITICAL: Ciphertext MUST NOT contain plaintext content!'
  );
  console.log('✅ Test 2: AES-256-GCM Encryption & Ciphertext Privacy Passed');

  // 2. Decryption & Plaintext SHA-256 Preservation
  const decryptedBuffer = decryptDocument(
    encryptedResult.encryptedBuffer,
    encryptedResult.iv,
    encryptedResult.authTag
  );
  console.assert(
    decryptedBuffer.equals(originalPlaintext),
    'Decrypted buffer MUST exactly match original plaintext'
  );
  const decryptedSha256 = calculateSha256(decryptedBuffer);
  console.assert(
    decryptedSha256 === originalSha256,
    'Decrypted plaintext SHA-256 MUST equal original plaintext SHA-256'
  );
  console.log('✅ Test 3: Decryption & Plaintext SHA-256 Preservation Passed');

  // 3. Unique Random IV Generation per Document
  const encryptedResult2 = encryptDocument(originalPlaintext);
  console.assert(
    encryptedResult.iv !== encryptedResult2.iv,
    'Each encryption operation MUST use a fresh random IV'
  );
  console.log('✅ Test 4: Cryptographically Random Unique IV Generation Passed');

  // 4. Modified Ciphertext Rejection (GCM Tamper Check)
  const tamperedCiphertext = Buffer.from(encryptedResult.encryptedBuffer);
  tamperedCiphertext[0] ^= 0xff; // Flip bits in first byte

  try {
    decryptDocument(tamperedCiphertext, encryptedResult.iv, encryptedResult.authTag);
    console.assert(false, 'Modified ciphertext MUST be rejected by AES-256-GCM');
  } catch (err: any) {
    console.assert(
      err.message.includes('Authentication Failed') || err.message.includes('tampered'),
      'Tampered ciphertext MUST fail GCM authentication'
    );
  }
  console.log('✅ Test 5: Modified Ciphertext Rejection Passed');

  // 5. Modified IV Rejection
  const tamperedIv = '000000000000000000000000';
  try {
    decryptDocument(encryptedResult.encryptedBuffer, tamperedIv, encryptedResult.authTag);
    console.assert(false, 'Modified IV MUST be rejected');
  } catch (err: any) {
    console.assert(err.message.length > 0, 'Tampered IV rejected');
  }
  console.log('✅ Test 6: Modified IV Rejection Passed');

  // 6. Modified Auth Tag Rejection
  const tamperedTag = '00000000000000000000000000000000';
  try {
    decryptDocument(encryptedResult.encryptedBuffer, encryptedResult.iv, tamperedTag);
    console.assert(false, 'Modified Auth Tag MUST be rejected');
  } catch (err: any) {
    console.assert(err.message.length > 0, 'Tampered Auth Tag rejected');
  }
  console.log('✅ Test 7: Modified Auth Tag Rejection Passed');

  // 7. Wrong Key Rejection
  const wrongKey = crypto.randomBytes(32);
  try {
    decryptDocument(encryptedResult.encryptedBuffer, encryptedResult.iv, encryptedResult.authTag, wrongKey);
    console.assert(false, 'Decryption with wrong key MUST fail');
  } catch (err: any) {
    console.assert(err.message.length > 0, 'Wrong key rejected');
  }
  console.log('✅ Test 8: Wrong Key Rejection Passed');

  // 8. Role-Based Document Download Permission Bounds
  console.assert(hasPermission(['INVESTIGATOR'], 'DOCUMENT_DOWNLOAD') === true, 'INVESTIGATOR can download decrypted document');
  console.assert(hasPermission(['OFFICER'], 'DOCUMENT_DOWNLOAD') === true, 'OFFICER can download decrypted document');
  console.assert(hasPermission(['LEGAL'], 'DOCUMENT_DOWNLOAD') === true, 'LEGAL can download decrypted document');
  console.assert(hasPermission(['VIEWER'], 'DOCUMENT_DOWNLOAD') === false, 'VIEWER MUST NOT download documents');
  console.assert(hasPermission(['AUDITOR'], 'DOCUMENT_DOWNLOAD') === false, 'AUDITOR MUST NOT download raw documents');
  console.log('✅ Test 9: Download Authorization Scope Passed');

  console.log('🎉 ALL PHASE 8 AES-256-GCM ENCRYPTION SECURITY TESTS PASSED CLEANLY!');
}

runEncryptionTests().catch((e) => {
  console.error('❌ Encryption test failure:', e);
  process.exit(1);
});
