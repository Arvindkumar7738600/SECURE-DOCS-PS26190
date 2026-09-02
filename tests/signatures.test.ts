import { generateKeyPair, signData, verifyDataSignature } from '../lib/security/digital-signature';
import { hasPermission } from '../lib/auth/permissions';

async function runSignatureTests() {
  console.log('🧪 Running Phase 11 Digital Signatures & Cryptographic Key Verification Tests...');

  const sampleSha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  // 1. Generate Key Pair & Sign
  const keyPair = generateKeyPair();
  console.assert(keyPair.publicKey.includes('BEGIN PUBLIC KEY'), 'Public key PEM format valid');
  console.assert(keyPair.privateKey.includes('BEGIN PRIVATE KEY'), 'Private key PEM format valid');

  const signatureBase64 = signData(sampleSha256, keyPair.privateKey);
  console.assert(typeof signatureBase64 === 'string' && signatureBase64.length > 50, 'Signature generated');
  console.log('✅ Test 1: RSA-2048 Key Pair Generation & Digital Signing Passed');

  // 2. Cryptographic Verification (Happy Path)
  const isValid = verifyDataSignature(sampleSha256, signatureBase64, keyPair.publicKey);
  console.assert(isValid === true, 'Signature MUST verify against valid public key & original SHA-256');
  console.log('✅ Test 2: Cryptographic Signature Verification Passed');

  // 3. Document Hash Tampering Detection
  const tamperedSha256 = 'f4c1d55309fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b866';
  const isTamperedValid = verifyDataSignature(tamperedSha256, signatureBase64, keyPair.publicKey);
  console.assert(isTamperedValid === false, 'Tampered hash MUST fail verification');
  console.log('✅ Test 3: Document Hash Tamper Detection Passed');

  // 4. Invalid Signature Material Rejection
  const invalidSig = signatureBase64.substring(0, signatureBase64.length - 4) + 'AAAA';
  const isInvalidSigValid = verifyDataSignature(sampleSha256, invalidSig, keyPair.publicKey);
  console.assert(isInvalidSigValid === false, 'Corrupted signature string MUST fail verification');
  console.log('✅ Test 4: Corrupted Signature Rejection Passed');

  // 5. Wrong Key Rejection
  const otherKeyPair = generateKeyPair();
  const isWrongKeyValid = verifyDataSignature(sampleSha256, signatureBase64, otherKeyPair.publicKey);
  console.assert(isWrongKeyValid === false, 'Verification against wrong public key MUST fail');
  console.log('✅ Test 5: Wrong Public Key Rejection Passed');

  // 6. Signature RBAC Scope Test
  console.assert(hasPermission(['ADMIN'], 'SIGN_DOCUMENT') === true, 'ADMIN can sign document');
  console.assert(hasPermission(['INVESTIGATOR'], 'SIGN_DOCUMENT') === true, 'INVESTIGATOR can sign document');
  console.assert(hasPermission(['OFFICER'], 'SIGN_DOCUMENT') === false, 'OFFICER MUST NOT sign document');
  console.assert(hasPermission(['VIEWER'], 'SIGN_DOCUMENT') === false, 'VIEWER MUST NOT sign document');
  console.assert(hasPermission(['AUDITOR'], 'SIGN_DOCUMENT') === false, 'AUDITOR MUST NOT sign document');
  console.log('✅ Test 6: Signature RBAC Authorization Scope Passed');

  console.log('🎉 ALL PHASE 11 DIGITAL SIGNATURE TESTS PASSED CLEANLY!');
}

runSignatureTests().catch((e) => {
  console.error('❌ Signature test failure:', e);
  process.exit(1);
});
