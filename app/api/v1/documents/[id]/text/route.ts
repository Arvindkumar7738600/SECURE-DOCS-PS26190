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

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!document || document.versions.length === 0) {
      return jsonResponseWithRequestId({ error: 'Document record not found' }, 404, requestId);
    }

    const version = document.versions[0];

    const pages = await prisma.ocrPage.findMany({
      where: { versionId: version.id },
      orderBy: { pageNumber: 'asc' },
      select: {
        pageNumber: true,
        text: true,
        confidence: true,
        method: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        documentId: id,
        versionNumber: version.versionNumber,
        totalPages: pages.length,
        pages,
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    console.error('Get Document Text API error:', error);
    return jsonResponseWithRequestId(
      { error: 'Internal server error fetching document text' },
      500,
      requestId
    );
  }
}
