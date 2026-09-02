import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { jsonResponseWithRequestId } from '@/lib/observability/response';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'DOCUMENT_READ');
  if (!auth.authorized || !auth.user) {
    return jsonResponseWithRequestId({ error: 'Unauthorized' }, 401, requestId);
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return jsonResponseWithRequestId({ error: 'Document not found or access denied' }, 404, requestId);
    }

    const latestJob = await prisma.processingJob.findFirst({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
    });

    const ocrPageCount = await prisma.ocrPage.count({
      where: { documentId: id },
    });

    return NextResponse.json(
      {
        documentId: id,
        jobId: latestJob?.id || null,
        status: latestJob?.status || 'QUEUED',
        currentStep: latestJob?.currentStep || 'UPLOADED',
        progress: null, // No fake progress percentages
        errorMessage: latestJob?.errorMessage || null,
        ocrPagesCount: ocrPageCount,
        ocrStatus: ocrPageCount > 0 ? 'COMPLETED' : latestJob?.status || 'QUEUED',
        startedAt: latestJob?.startedAt || null,
        completedAt: latestJob?.completedAt || null,
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    console.error('Get Document Status API error:', error);
    return jsonResponseWithRequestId({ error: 'Internal server error getting status' }, 500, requestId);
  }
}
