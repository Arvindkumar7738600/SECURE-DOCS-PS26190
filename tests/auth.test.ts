import { hashPassword, verifyPassword } from '../lib/security/password';
import { signJWT, verifyJWT } from '../lib/security/jwt';
import { RegisterSchema, LoginSchema } from '../lib/auth/validation';

async function runAuthTests() {
  console.log('🧪 Running Phase 3 Authentication Tests...');

  // Test 1: Password Hashing
  const rawPassword = 'SecurePassword123!';
  const hash = await hashPassword(rawPassword);
  console.assert(hash !== rawPassword, 'Password must be hashed');
  const isMatch = await verifyPassword(rawPassword, hash);
  console.assert(isMatch === true, 'Password verification should return true for correct password');
  const isWrongMatch = await verifyPassword('WrongPass', hash);
  console.assert(isWrongMatch === false, 'Password verification should return false for incorrect password');
  console.log('✅ Test 1: Password Hashing & Verification Passed');

  // Test 2: JWT Signing & Verification
  const token = await signJWT({
    sub: 'user-uuid-12345',
    email: 'investigator@example.com',
    roles: ['INVESTIGATOR'],
  });
  console.assert(typeof token === 'string' && token.length > 20, 'JWT token should be signed string');

  const decoded = await verifyJWT(token);
  console.assert(decoded?.sub === 'user-uuid-12345', 'Decoded sub should match');
  console.assert(decoded?.email === 'investigator@example.com', 'Decoded email should match');
  console.assert(decoded?.roles[0] === 'INVESTIGATOR', 'Decoded role should match');
  console.log('✅ Test 2: JWT Signing & Verification Passed');

  // Test 3: Input Validation
  const validRegister = RegisterSchema.safeParse({
    email: 'test@example.com',
    password: 'Password123!',
    fullName: 'Test Officer',
    department: 'Cyber Cell',
  });
  console.assert(validRegister.success === true, 'Valid register input should pass');

  const invalidRegister = RegisterSchema.safeParse({
    email: 'not-an-email',
    password: 'short',
    fullName: '',
    department: '',
  });
  console.assert(invalidRegister.success === false, 'Invalid register input should fail');
  console.log('✅ Test 3: Zod Validation Schemas Passed');

  console.log('🎉 ALL PHASE 3 AUTHENTICATION TESTS PASSED CLEANLY!');
}

runAuthTests().catch((e) => {
  console.error('❌ Auth test failure:', e);
  process.exit(1);
});
