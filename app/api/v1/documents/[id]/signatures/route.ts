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

    const signatures = await prisma.signature.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        signer: {
          select: { id: true, fullName: true, email: true, department: true },
        },
        version: {
          select: { versionNumber: true, sha256: true },
        },
      },
    });

    return NextResponse.json(
      {
        documentId: id,
        signatures,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get Signatures API error:', error);
    return NextResponse.json({ error: 'Internal server error fetching signatures' }, { status: 500 });
  }
}
