import { PrismaClient } from '@prisma/client';
import { normalizeDatabaseUrl, validateServerEnv } from '@/lib/config/env';

const serverEnv = validateServerEnv();
const databaseUrl = normalizeDatabaseUrl(serverEnv.databaseUrl);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
