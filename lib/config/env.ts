export interface ServerEnv {
  databaseUrl: string;
  jwtSecret: string;
  encryptionMasterKey?: string;
  isProduction: boolean;
}

let validatedEnvCache: ServerEnv | null = null;

export function normalizeDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);

    if (url.protocol.startsWith('postgres')) {
      const path = url.pathname.replace(/\.public$/, '');
      if (path !== url.pathname) {
        url.pathname = path;
      }
    }

    return url.toString();
  } catch {
    return databaseUrl;
  }
}

export function validateServerEnv(): ServerEnv {
  if (validatedEnvCache) return validatedEnvCache;

  const isProduction = process.env.NODE_ENV === 'production';
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_SIGNING_SECRET;
  const encryptionMasterKey =
    process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_MASTER_KEY || process.env.DOCUMENT_ENCRYPTION_KEY;

  const missing: string[] = [];

  if (!databaseUrl) missing.push('DATABASE_URL');
  if (!jwtSecret && isProduction) missing.push('JWT_SECRET');

  const isBuildPhase = process.env.NEXT_PHASE !== undefined;

  if (missing.length > 0 && isProduction && !isBuildPhase) {
    console.error(`[ENV] Missing required environment variables: ${missing.join(', ')}`);
    throw new Error('Server configuration error. Check server logs for details.');
  }

  if (missing.length > 0 && (!isProduction || isBuildPhase)) {
    console.warn(`[ENV] Warning: Missing environment variables: ${missing.join(', ')}. Using fallback values.`);
  }

  validatedEnvCache = {
    databaseUrl: databaseUrl || 'postgresql://localhost:5432/secure_case_db',
    jwtSecret: jwtSecret || 'DEV_FALLBACK_JWT_SECRET_INSECURE_FOR_PRODUCTION_ONLY_32_BYTES',
    encryptionMasterKey,
    isProduction,
  };

  return validatedEnvCache;
}
