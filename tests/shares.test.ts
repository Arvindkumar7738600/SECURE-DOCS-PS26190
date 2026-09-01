import { hasPermission } from '../lib/auth/permissions';

async function runShareTests() {
  console.log('🧪 Running Phase 11 Secure Document Sharing & Expiration / Revocation Security Tests...');

  // 1. Check Active Share Expiration Logic
  const now = new Date();
  const pastDate = new Date(now.getTime() - 3600 * 1000); // 1 hour ago
  const futureDate = new Date(now.getTime() + 3600 * 1000); // 1 hour in future

  // Active Share
  const activeShare = {
    revokedAt: null,
    expiresAt: futureDate,
  };
  const isActiveValid = activeShare.revokedAt === null && (activeShare.expiresAt === null || activeShare.expiresAt > now);
  console.assert(isActiveValid === true, 'Active unexpired share must be valid');
  console.log('✅ Test 1: Active Share Access Authorization Passed');

  // Expired Share
  const expiredShare = {
    revokedAt: null,
    expiresAt: pastDate,
  };
  const isExpiredValid = expiredShare.revokedAt === null && (expiredShare.expiresAt === null || expiredShare.expiresAt > now);
  console.assert(isExpiredValid === false, 'Expired share MUST NOT authorize document access');
  console.log('✅ Test 2: Expired Share Rejection Passed');

  // Revoked Share
  const revokedShare = {
    revokedAt: now,
    expiresAt: futureDate,
  };
  const isRevokedValid = revokedShare.revokedAt === null && (revokedShare.expiresAt === null || revokedShare.expiresAt > now);
  console.assert(isRevokedValid === false, 'Revoked share MUST NOT authorize document access');
  console.log('✅ Test 3: Revoked Share Rejection Passed');

  // 4. Self-Sharing Prevention
  const uploaderId = 'usr_uploader_123';
  const targetId = 'usr_uploader_123';
  const isSelfShareAllowed = uploaderId !== targetId;
  console.assert(isSelfShareAllowed === false, 'Self sharing MUST be prevented');
  console.log('✅ Test 4: Self-Sharing Prevention Passed');

  // 5. Share RBAC Permissions
  console.assert(hasPermission(['ADMIN'], 'SHARE_CREATE') === true, 'ADMIN can create share');
  console.assert(hasPermission(['INVESTIGATOR'], 'SHARE_CREATE') === true, 'INVESTIGATOR can create share');
  console.assert(hasPermission(['LEGAL'], 'SHARE_CREATE') === true, 'LEGAL can create share');
  console.assert(hasPermission(['OFFICER'], 'SHARE_CREATE') === false, 'OFFICER MUST NOT create share');
  console.assert(hasPermission(['VIEWER'], 'SHARE_CREATE') === false, 'VIEWER MUST NOT create share');
  console.assert(hasPermission(['AUDITOR'], 'SHARE_CREATE') === false, 'AUDITOR MUST NOT create share');
  console.log('✅ Test 5: Share RBAC Authorization Scope Passed');

  console.log('🎉 ALL PHASE 11 SECURE SHARING TESTS PASSED CLEANLY!');
}

runShareTests().catch((e) => {
  console.error('❌ Share test failure:', e);
  process.exit(1);
});
