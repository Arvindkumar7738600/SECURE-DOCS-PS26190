import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { AuditAction } from '@prisma/client';
import { safeError } from '@/lib/observability/safe-logger';

export interface AuditParams {
  userId?: string | null;
  caseId?: string | null;
  documentId?: string | null;
  action: AuditAction;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  requestId?: string | null;
}

export function reportAuditWriteFailure(error: unknown, context: Pick<AuditParams, 'action' | 'userId' | 'caseId' | 'documentId' | 'requestId'>): void {
  safeError(
    'Failed to write audit log entry',
    {
      ...context,
      error,
    },
    context.requestId || undefined
  );
}

export function sanitizeAuditMetadata(metadata: Record<string, any>): Record<string, any> {
  if (!metadata || typeof metadata !== 'object') return {};
  const SENSITIVE_KEYS = ['password', 'secret', 'token', 'privatekey', 'recoverycode', 'key', 'authorization', 'bearer'];

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
      clean[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizeAuditMetadata(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export async function logAuditEvent({
  userId = null,
  caseId = null,
  documentId = null,
  action,
  ipAddress = '127.0.0.1',
  userAgent = 'Internal',
  metadata = {},
  requestId = null,
}: AuditParams) {
  try {
    const sanitizedMetadata = sanitizeAuditMetadata(metadata);

    // 1. Get the previous audit log hash for hash chain
    const lastAudit = await prisma.auditLog.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { currentHash: true },
    });

    const previousHash = lastAudit?.currentHash || 'GENESIS_BLOCK_00000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();

    // 2. Compute current SHA-256 hash of the audit entry
    const hashData = `${previousHash}|${userId || ''}|${caseId || ''}|${documentId || ''}|${action}|${timestamp}|${ipAddress}|${requestId || ''}|${JSON.stringify(sanitizedMetadata)}`;
    const currentHash = crypto.createHash('sha256').update(hashData).digest('hex');

    // 3. Create AuditLog database record
    return await prisma.auditLog.create({
      data: {
        userId,
        caseId,
        documentId,
        action,
        ipAddress,
        userAgent,
        metadata: { ...sanitizedMetadata, requestId },
        previousHash,
        currentHash,
      },
    });
  } catch (error) {
    reportAuditWriteFailure(error, { action, userId, caseId, documentId, requestId });
    return null;
  }
}
