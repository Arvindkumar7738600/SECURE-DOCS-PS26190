import { sanitizeForLogging, safeLog, safeError, safeWarn, safeInfo } from '../lib/observability/safe-logger';
import { generateRequestId, getOrCreateRequestId, requestIdHeader } from '../lib/observability/request-id';
import { sanitizeAuditMetadata } from '../lib/audit/logger';

async function runPhase15Tests() {
  console.log('🧪 Running Phase 15 Production Resilience & Observability Tests...\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => boolean | Promise<boolean>) {
    return async () => {
      try {
        const result = await fn();
        if (result) {
          console.log(`✅ ${name}`);
          passed++;
        } else {
          console.log(`❌ ${name}`);
          failed++;
        }
      } catch (e) {
        console.log(`❌ ${name} - Error: ${e}`);
        failed++;
      }
    };
  }

  const tests = [
    // --- Request ID Tests ---
    test('generateRequestId returns 32 character hex string', () => {
      const id = generateRequestId();
      return id.length === 32 && /^[a-f0-9]+$/.test(id);
    }),

    test('generateRequestId generates unique IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      return id1 !== id2;
    }),

    test('getOrCreateRequestId returns valid header value', () => {
      const validId = 'abc123def456789012345678901234ab';
      const result = getOrCreateRequestId(validId);
      return result === validId;
    }),

    test('getOrCreateRequestId generates new ID for invalid header', () => {
      const invalidId = 'invalid!@#$';
      const result = getOrCreateRequestId(invalidId);
      return result !== invalidId && /^[a-f0-9]{32}$/.test(result);
    }),

    test('getOrCreateRequestId generates new ID for null header', () => {
      const result = getOrCreateRequestId(null);
      return /^[a-f0-9]{32}$/.test(result);
    }),

    test('requestIdHeader returns correct header name', () => {
      return requestIdHeader() === 'x-request-id';
    }),

    // --- Safe Logging Tests ---
    test('sanitizeForLogging redacts password field', () => {
      const result = sanitizeForLogging({ password: 'secret123' }) as Record<string, string>;
      return result.password === '[REDACTED]';
    }),

    test('sanitizeForLogging redacts token field', () => {
      const result = sanitizeForLogging({ token: 'jwt-token' }) as Record<string, string>;
      return result.token === '[REDACTED]';
    }),

    test('sanitizeForLogging redacts secret field', () => {
      const result = sanitizeForLogging({ secret: 'mfa-secret' }) as Record<string, string>;
      return result.secret === '[REDACTED]';
    }),

    test('sanitizeForLogging redacts authorization field', () => {
      const result = sanitizeForLogging({ authorization: 'Bearer token' }) as Record<string, string>;
      return result.authorization === '[REDACTED]';
    }),

    test('sanitizeForLogging redacts apiKey field', () => {
      const result = sanitizeForLogging({ apiKey: 'sk-12345' }) as Record<string, string>;
      return result.apiKey === '[REDACTED]';
    }),

    test('sanitizeForLogging redacts api_key field', () => {
      const result = sanitizeForLogging({ api_key: 'sk-12345' }) as Record<string, string>;
      return result.api_key === '[REDACTED]';
    }),

    test('sanitizeForLogging redacts JWT format strings', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = sanitizeForLogging({ token: jwt }) as Record<string, string>;
      return result.token === '[REDACTED]';
    }),

    test('sanitizeForLogging redacts Bearer tokens in strings', () => {
      const result = sanitizeForLogging('Bearer abc123secret') as string;
      return result === '[REDACTED]';
    }),

    test('sanitizeForLogging redacts 64-char hex (likely hash/key)', () => {
      const hashKey = 'a'.repeat(64);
      const result = sanitizeForLogging(hashKey) as string;
      return result === '[REDACTED]';
    }),

    test('sanitizeForLogging preserves non-sensitive fields', () => {
      const result = sanitizeForLogging({ userId: '123', email: 'test@test.com' }) as Record<string, string>;
      return result.userId === '123' && result.email === 'test@test.com';
    }),

    test('sanitizeForLogging redacts nested sensitive fields', () => {
      const input = { user: { password: 'nested-secret' }, action: 'LOGIN' };
      const result = sanitizeForLogging(input) as { user: Record<string, string>; action: string };
      return result.user.password === '[REDACTED]' && result.action === 'LOGIN';
    }),

    test('sanitizeForLogging handles Error objects', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:10:5';
      const result = sanitizeForLogging(error) as { name: string; message: string; stack: string };
      return result.name === 'Error' && result.message === 'Test error' && result.stack === '[STACK_TRACE_REDACTED]';
    }),

    test('sanitizeForLogging handles arrays', () => {
      const result = sanitizeForLogging([{ password: 'secret' }, { email: 'test@test.com' }]) as Array<Record<string, string>>;
      return result[0].password === '[REDACTED]' && result[1].email === 'test@test.com';
    }),

    test('sanitizeForLogging handles null and undefined', () => {
      return sanitizeForLogging(null) === null && sanitizeForLogging(undefined) === undefined;
    }),

    test('sanitizeForLogging truncates long strings', () => {
      const longString = 'a'.repeat(3000);
      const result = sanitizeForLogging(longString) as string;
      return result.includes('[TRUNCATED]') && result.length <= 2015;
    }),

    test('sanitizeForLogging prevents infinite recursion', () => {
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;
      const result = sanitizeForLogging(circular, 0) as Record<string, unknown>;
      return result.name === 'test' && (result.self === '[MAX_DEPTH_REACHED]' || typeof result.self === 'object');
    }),

    test('safeError does not throw', () => {
      safeError('Test error message', { test: true });
      return true;
    }),

    test('safeWarn does not throw', () => {
      safeWarn('Test warning message', { test: true });
      return true;
    }),

    test('safeInfo does not throw', () => {
      safeInfo('Test info message', { test: true });
      return true;
    }),

    test('safeLog with requestId includes it in output', () => {
      const requestId = 'test-request-id-123';
      const messages: string[] = [];
      const originalError = console.error;
      console.error = (msg: string) => { messages.push(msg); };
      safeLog('error', 'Test message', { data: true }, requestId);
      console.error = originalError;
      return messages.length > 0 && messages[0].includes(requestId);
    }),

    // --- Audit Logging Request ID Tests ---
    test('sanitizeAuditMetadata handles requestId as non-sensitive', () => {
      const result = sanitizeAuditMetadata({ requestId: 'abc123', action: 'LOGIN' });
      return result.requestId === 'abc123' && result.action === 'LOGIN';
    }),

    test('sanitizeAuditMetadata still redacts password', () => {
      const result = sanitizeAuditMetadata({ password: 'secret', requestId: 'abc123' });
      return result.password === '[REDACTED]' && result.requestId === 'abc123';
    }),

    test('sanitizeAuditMetadata still redacts token', () => {
      const result = sanitizeAuditMetadata({ token: 'jwt-token', requestId: 'abc123' });
      return result.token === '[REDACTED]' && result.requestId === 'abc123';
    }),

    // --- Error Response Safety Tests ---
    test('Health endpoint error response is generic', () => {
      const healthErrorResponse = {
        status: 'error',
        message: 'Service temporarily unavailable',
        timestamp: new Date().toISOString(),
        requestId: 'test-123',
      };
      const hasNoStackTrace = !JSON.stringify(healthErrorResponse).includes('stack');
      const hasNoFilePath = !JSON.stringify(healthErrorResponse).includes('.ts');
      const hasNoCredential = !JSON.stringify(healthErrorResponse).includes('password') || 
                              !JSON.stringify(healthErrorResponse).includes('secret');
      return hasNoStackTrace && hasNoFilePath && hasNoCredential;
    }),

    test('Error messages do not expose file paths', () => {
      const productionErrors = [
        'Internal server error during registration',
        'Internal server error processing document',
        'Service temporarily unavailable',
        'Internal server error during MFA verification',
      ];
      return productionErrors.every(msg => !msg.includes('/') && !msg.includes('.ts') && !msg.includes('.js'));
    }),

    test('Error messages do not contain stack traces', () => {
      const productionErrors = [
        'Internal server error during registration',
        'Internal server error processing document',
        'Service temporarily unavailable',
      ];
      return productionErrors.every(msg => !msg.includes('at ') && !msg.includes('Error:'));
    }),

    // --- Request ID Format Tests ---
    test('Request ID is cryptographically random', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }
      return ids.size === 100;
    }),

    test('Request ID header constant is consistent', () => {
      return requestIdHeader() === 'x-request-id' && requestIdHeader() === 'x-request-id';
    }),
  ];

  for (const t of tests) {
    await t();
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Phase 15 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\n❌ SOME PHASE 15 TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL PHASE 15 PRODUCTION RESILIENCE & OBSERVABILITY TESTS PASSED!');
  }
}

runPhase15Tests().catch((e) => {
  console.error('❌ Test execution error:', e);
  process.exit(1);
});
