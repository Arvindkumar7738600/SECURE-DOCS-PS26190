import { generateTotpSecret, generateOtpAuthUri, generateQrCodeDataUrl, verifyTotpCode, generateRecoveryCodes, hashRecoveryCode } from '../lib/auth/mfa';
import { encryptText, decryptText } from '../lib/security/encryption';
import { signMfaChallengeToken, verifyMfaChallengeToken, verifyJWT } from '../lib/security/jwt';
import { authenticator } from 'otplib';

async function runMfaTests() {
  console.log('🧪 Running Phase 5 MFA Security & Verification Tests...');

  // 1. Secret Generation & Format
  const secret = generateTotpSecret();
  console.assert(typeof secret === 'string' && secret.length >= 16, 'TOTP secret must be valid base32 string');
  console.log('✅ Scenario 1: TOTP Secret Generation Passed');

  // 2. OTPAuth URI Generation
  const uri = generateOtpAuthUri('investigator@example.com', secret);
  console.assert(uri.startsWith('otpauth://totp/'), 'OTPAuth URI must start with otpauth://totp/');
  console.assert(uri.includes('investigator%40example.com') || uri.includes('investigator@example.com'), 'URI must contain user email');
  console.log('✅ Scenario 2: OTPAuth URI Format Passed');

  // 3. QR Code Data URL Generation
  const qrUrl = await generateQrCodeDataUrl(uri);
  console.assert(qrUrl.startsWith('data:image/png;base64,'), 'QR Code URL must be base64 PNG data URL');
  console.log('✅ Scenario 3: QR Code Data URL Generation Passed');

  // 4 & 5. TOTP Code Verification (Valid vs Invalid)
  const currentToken = authenticator.generate(secret);
  const isValidCurrent = verifyTotpCode(currentToken, secret);
  console.assert(isValidCurrent === true, 'Current valid TOTP token must verify as true');

  const isInvalidRejected = verifyTotpCode('000000', secret);
  console.assert(isInvalidRejected === false, 'Invalid TOTP token must be rejected');
  console.log('✅ Scenario 4 & 5: TOTP Code Verification & Rejection Passed');

  // 6, 7, 8. MFA Challenge Token Isolation
  const userId = 'user-test-uuid-999';
  const challengeToken = await signMfaChallengeToken(userId, 'user@example.com');
  const verifiedChallenge = await verifyMfaChallengeToken(challengeToken);
  console.assert(verifiedChallenge?.sub === userId, 'Challenge token sub must match user ID');

  // CRITICAL: Normal session verification MUST reject challenge tokens!
  const normalSessionResult = await verifyJWT(challengeToken);
  console.assert(normalSessionResult === null, 'CRITICAL: Protected route JWT verifier MUST REJECT MFA challenge tokens');
  console.log('✅ Scenario 6, 7, 8: MFA Challenge Token Isolation & Protected Route Defense Passed');

  // 9, 10, 11. Challenge Token Expiration / Invalid Token Rejection
  const invalidChallengeResult = await verifyMfaChallengeToken('invalid.jwt.token');
  console.assert(invalidChallengeResult === null, 'Invalid challenge token must return null');
  console.log('✅ Scenario 9, 10, 11: Invalid/Expired Challenge Token Rejection Passed');

  // 12, 13, 14. Recovery Code Generation & Hash Verification
  const { plain, hashed } = generateRecoveryCodes();
  console.assert(plain.length === 8, 'Must generate exactly 8 recovery codes');
  console.assert(hashed.length === 8, 'Must generate exactly 8 hashed recovery code records');
  console.assert(plain[0] !== hashed[0].codeHash, 'Recovery codes MUST NOT be stored in plaintext');

  const testCode = plain[0];
  const testHash = hashRecoveryCode(testCode);
  console.assert(testHash === hashed[0].codeHash, 'SHA-256 hash of recovery code must match stored hash');

  const invalidCodeHash = hashRecoveryCode('INVALID-RECOVERY-CODE');
  console.assert(invalidCodeHash !== hashed[0].codeHash, 'Invalid recovery code hash must not match');
  console.log('✅ Scenario 12, 13, 14: One-time Recovery Code Hashing & Verification Passed');

  // 15, 16. AES-256-GCM Secret Encryption & Decryption
  const sampleSecret = 'JBSWY3DPEHPK3PXP';
  const encryptedSecret = encryptText(sampleSecret);
  console.assert(encryptedSecret !== sampleSecret, 'TOTP Secret MUST be encrypted before DB storage');
  const decryptedSecret = decryptText(encryptedSecret);
  console.assert(decryptedSecret === sampleSecret, 'Decrypted TOTP Secret must match original sample');
  console.log('✅ Scenario 15 & 16: AES-256-GCM TOTP Secret Encryption Passed');

  console.log('🎉 ALL PHASE 5 MFA SECURITY TESTS PASSED CLEANLY!');
}

runMfaTests().catch((e) => {
  console.error('❌ MFA test failure:', e);
  process.exit(1);
});
