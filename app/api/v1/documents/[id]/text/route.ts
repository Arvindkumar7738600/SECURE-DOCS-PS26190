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

    const sanitizedPages = pages.map((p) => {
      const textVal = p.text || '';
      const isBadGibberish =
        textVal.includes('cCfCj') ||
        textVal.includes('\uFFFD') ||
        textVal.includes('\0') ||
        ((textVal.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFD]/g) || []).length / (textVal.length || 1) > 0.1);

      const isPlaceholder = !textVal || isBadGibberish;

      return {
        ...p,
        text: isPlaceholder
          ? 'No OCR text extracted yet. Click "Re-upload Evidence File" or "Run OCR Pipeline" to extract text from your evidence image.'
          : textVal,
      };
    });

    if (sanitizedPages.some((p) => p.text.startsWith('No OCR text extracted yet'))) {
      await prisma.ocrPage.deleteMany({ where: { versionId: version.id } }).catch(() => {});
    }

    return NextResponse.json(
      {
        documentId: id,
        versionNumber: version.versionNumber,
        totalPages: sanitizedPages.length,
        pages: sanitizedPages,
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

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'DOCUMENT_UPDATE');
  if (!auth.authorized || !auth.user) {
    return jsonResponseWithRequestId({ error: 'Unauthorized' }, 401, requestId);
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return jsonResponseWithRequestId({ error: 'Document not found or access denied' }, 404, requestId);
    }

    const body = await req.json();
    const { pageNumber, text } = body;

    if (typeof pageNumber !== 'number' || typeof text !== 'string') {
      return jsonResponseWithRequestId({ error: 'pageNumber (number) and text (string) are required' }, 400, requestId);
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!document || document.versions.length === 0) {
      return jsonResponseWithRequestId({ error: 'Document record not found' }, 404, requestId);
    }

    const version = document.versions[0];

    const updated = await prisma.ocrPage.updateMany({
      where: { versionId: version.id, pageNumber },
      data: { text: text.trim() },
    });

    return jsonResponseWithRequestId(
      { message: 'OCR page text updated successfully', count: updated.count },
      200,
      requestId
    );
  } catch (error: any) {
    console.error('PATCH Document Text API error:', error);
    return jsonResponseWithRequestId(
      { error: 'Internal server error updating document text' },
      500,
      requestId
    );
  }
}
