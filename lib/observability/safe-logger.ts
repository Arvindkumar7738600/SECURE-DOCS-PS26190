const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /privatekey/i,
  /recoverycode/i,
  /^key$/i,
  /authorization/i,
  /bearer/i,
  /jwt/i,
  /otp/i,
  /totp/i,
  /mfa/i,
  /encryption/i,
  /credential/i,
  /api[-_]?key/i,
];

const SENSITIVE_VALUE_REPLACEMENT = '[REDACTED]';
const MAX_LOG_LENGTH = 2000;
const STACK_TRACE_REPLACEMENT = '[STACK_TRACE_REDACTED]';

export function sanitizeForLogging(value: unknown, depth: number = 0): unknown {
  if (depth > 10) {
    return '[MAX_DEPTH_REACHED]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeStringValue(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeStringValue(value.message),
      stack: STACK_TRACE_REPLACEMENT,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogging(item, depth + 1));
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_PATTERNS.some((pattern) => pattern.test(lowerKey));
      
      if (isSensitive) {
        sanitized[key] = SENSITIVE_VALUE_REPLACEMENT;
      } else {
        sanitized[key] = sanitizeForLogging(val, depth + 1);
      }
    }
    return sanitized;
  }

  return String(value).substring(0, MAX_LOG_LENGTH);
}

function sanitizeStringValue(value: string): string {
  let sanitized = value;
  
  if (sanitized.length > MAX_LOG_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LOG_LENGTH) + '...[TRUNCATED]';
  }
  
  const jwtPattern = /^eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*$/;
  if (jwtPattern.test(sanitized)) {
    return SENSITIVE_VALUE_REPLACEMENT;
  }
  
  if (/[a-f0-9]{64}/i.test(sanitized) && sanitized.length === 64) {
    return SENSITIVE_VALUE_REPLACEMENT;
  }
  
  if (/^Bearer\s+/i.test(sanitized)) {
    return SENSITIVE_VALUE_REPLACEMENT;
  }
  
  return sanitized;
}

export function safeLog(level: 'error' | 'warn' | 'info', message: string, data?: unknown, requestId?: string): void {
  const prefix = requestId ? `[${requestId}] ` : '';
  const sanitizedData = data ? sanitizeForLogging(data) : undefined;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: prefix + message,
    ...(sanitizedData !== undefined && { data: sanitizedData }),
  };
  
  const output = JSON.stringify(logEntry);
  
  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

export function safeError(message: string, error?: unknown, requestId?: string): void {
  safeLog('error', message, error, requestId);
}

export function safeWarn(message: string, data?: unknown, requestId?: string): void {
  safeLog('warn', message, data, requestId);
}

export function safeInfo(message: string, data?: unknown, requestId?: string): void {
  safeLog('info', message, data, requestId);
}
