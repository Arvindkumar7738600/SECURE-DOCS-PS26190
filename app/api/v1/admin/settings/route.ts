import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/authorization';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';
import { AuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'SYSTEM_ADMIN');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse ?? NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  try {
    // Safe config — NEVER expose: DATABASE_URL, JWT_SECRET, AUTH_SECRET,
    // ENCRYPTION_KEY, DOCUMENT_ENCRYPTION_KEY, OPENAI_API_KEY, HUGGINGFACE_API_KEY,
    // BLOB_READ_WRITE_TOKEN, LLM_API_KEY
    const config = {
      system: {
        nodeEnv: process.env.NODE_ENV ?? 'unknown',
        isProduction: process.env.NODE_ENV === 'production',
        nextVersion: process.env.NEXT_RUNTIME ?? 'edge/node',
      },
      authentication: {
        mfaCapable: true, // MFA device model exists and is in schema
        jwtConfigured: Boolean(process.env.JWT_SECRET || process.env.JWT_SIGNING_SECRET),
        authSecretConfigured: Boolean(process.env.AUTH_SECRET),
        sessionType: 'JWT (HttpOnly Cookie)',
      },
      storage: {
        blobStorageConfigured: Boolean(
          process.env.BLOB_READ_WRITE_TOKEN &&
          process.env.BLOB_READ_WRITE_TOKEN !== 'vercel_blob_rw_dummy_token_for_local_dev'
        ),
        encryptionConfigured: Boolean(
          process.env.ENCRYPTION_KEY || process.env.DOCUMENT_ENCRYPTION_KEY
        ),
        encryptionAlgorithm: 'AES-256-GCM',
        maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? '50', 10),
      },
      ai: {
        ocrEnabled: process.env.OCR_ENABLED === 'true',
        embeddingProvider: process.env.EMBEDDING_PROVIDER ?? 'not configured',
        embeddingProviderConfigured: (() => {
          const provider = process.env.EMBEDDING_PROVIDER ?? '';
          if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
          if (provider === 'huggingface') return Boolean(process.env.HUGGINGFACE_API_KEY);
          if (provider === 'local_mock_vectors') return true;
          return false;
        })(),
        llmEnabled: process.env.LLM_ENABLED === 'true',
        llmConfigured: Boolean(process.env.LLM_API_KEY),
      },
      database: {
        provider: 'PostgreSQL',
        extensions: ['pgvector'],
        connectionConfigured: Boolean(process.env.DATABASE_URL),
        rbacEnabled: true,
        auditChainEnabled: true,
      },
      auditActions: Object.values(AuditAction),
    };

    return NextResponse.json(
      { config },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error) {
    safeError('Admin Settings API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error loading settings' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
