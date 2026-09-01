import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { ClassificationService } from '@/lib/ai/classification/service';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';

  const auth = await authorizeRequest(req, 'DOCUMENT_UPDATE');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    const pages = await prisma.ocrPage.findMany({
      where: { documentId: id },
      orderBy: { pageNumber: 'asc' },
    });

    const combinedText = pages.map((p) => p.text).join('\n\n');
    const classificationResult = await ClassificationService.classifyDocument(combinedText);

    // Update document & metadata record
    await prisma.$transaction([
      prisma.document.update({
        where: { id },
        data: { documentType: classificationResult.classification },
      }),
      prisma.documentMetadata.upsert({
        where: { documentId: id },
        create: {
          documentId: id,
          rawMetadata: JSON.parse(JSON.stringify({ classification: classificationResult })),
        },
        update: {
          rawMetadata: JSON.parse(JSON.stringify({ classification: classificationResult })),
        },
      }),
    ]);

    await logAuditEvent({
      userId: auth.user.id,
      documentId: id,
      action: AuditAction.EDIT_METADATA,
      ipAddress,
      userAgent,
      metadata: { action: 'CLASSIFY_DOCUMENT', classification: classificationResult },
    });

    return NextResponse.json(
      { message: 'Document classified successfully', classification: classificationResult },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Classify Document API error:', error);
    return NextResponse.json({ error: 'Internal server error classifying document' }, { status: 500 });
  }
}
