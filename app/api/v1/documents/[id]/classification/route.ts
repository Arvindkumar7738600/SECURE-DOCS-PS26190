import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params;

  const auth = await authorizeRequest(req, 'DOCUMENT_READ');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: { metadata: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const rawMeta: any = document.metadata?.rawMetadata || {};
    const classificationDetails = rawMeta.classification || {
      classification: document.documentType,
      confidence: 0.85,
      method: 'RULE_BASED',
      reason: 'Extracted from primary document record classification',
    };

    return NextResponse.json(
      {
        documentId: id,
        classification: classificationDetails,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get Classification API error:', error);
    return NextResponse.json({ error: 'Internal server error getting classification' }, { status: 500 });
  }
}
