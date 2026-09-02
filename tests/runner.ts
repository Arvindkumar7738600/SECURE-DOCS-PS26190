import { execSync } from 'child_process';
import path from 'path';

const testFiles = [
  'auth.test.ts',
  'encryption.test.ts',
  'signatures.test.ts',
  'mfa.test.ts',
  'rbac.test.ts',
  'security-boundaries.test.ts',
  'classification.test.ts',
  'metadata.test.ts',
  'ocr.test.ts',
  'phase16-embeddings.test.ts',
  'phase17-search.test.ts',
  'phase18-search-ui.test.ts',
  'phase19-production-security.test.ts',
  'phase20-document-storage.test.ts',
  'phase15-production-resilience.test.ts',
  'production-hardening.test.ts',
  'final-security-audit.test.ts',
];

console.log('🚀 Executing Complete Solvexa Case Management Test Suite...\n');

let passedCount = 0;
let failedCount = 0;

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);
  process.stdout.write(`Executing ${file}... `);

  try {
    execSync(`node -r tsx/cjs "${filePath}"`, { stdio: 'pipe' });
    console.log('✅ PASSED');
    passedCount += 1;
  } catch (error: any) {
    console.log('❌ FAILED');
    console.error(error.stdout?.toString() || error.stderr?.toString() || error.message);
    failedCount += 1;
  }
}

console.log('\n========================================');
console.log(`📊 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('========================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
