import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { validateServerEnv } from '@/lib/config/env';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = 'degraded';
    dbError = err?.message || 'Database connection error';
  }

  let envStatus = 'healthy';
  try {
    validateServerEnv();
  } catch (err: any) {
    envStatus = 'misconfigured';
  }

  const responseTimeMs = Date.now() - startTime;
  const isHealthy = dbStatus === 'healthy' && envStatus === 'healthy';

  return NextResponse.json(
    {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTimeMs,
      services: {
        database: {
          status: dbStatus,
          error: dbError,
        },
        environment: {
          status: envStatus,
        },
        ocr: {
          enabled: process.env.OCR_ENABLED !== 'false',
        },
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
