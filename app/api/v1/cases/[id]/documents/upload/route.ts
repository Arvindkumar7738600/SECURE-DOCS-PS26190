import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { authorizeRequest, canAccessCase } from '@/lib/auth/authorization';
import { validateFileMetadata, generateStorageKey, sanitizeFilename } from '@/lib/documents/validation';
import { prisma } from '@/lib/db/prisma';
import { DocumentType } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const caseId = params.id;

  const auth = await authorizeRequest(req, 'DOCUMENT_UPLOAD');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasCaseAccess = await canAccessCase(auth.user.id, auth.user.roles, caseId);
    if (!hasCaseAccess) {
      return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 });
    }

    const body = await req.json();
    const { filename, mimeType, sizeInBytes, documentType = DocumentType.OTHER } = body;

    if (!filename || !mimeType || !sizeInBytes) {
      return NextResponse.json(
        { error: 'filename, mimeType, and sizeInBytes are required' },
        { status: 400 }
      );
    }

    // Server-Side File Validation
    const validation = validateFileMetadata(filename, mimeType, Number(sizeInBytes));
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.errorCode || 422 }
      );
    }

    const sanitizedName = sanitizeFilename(filename);
    const documentId = crypto.randomUUID();
    const versionNumber = 1;
    const storageKey = generateStorageKey(caseId, documentId, versionNumber);

    // Verify requested documentType is valid enum
    const validDocType = Object.values(DocumentType).includes(documentType as DocumentType)
      ? (documentType as DocumentType)
      : DocumentType.OTHER;

    return NextResponse.json(
      {
        message: 'Upload request authorized. Proceed with client upload.',
        documentId,
        caseId,
        versionNumber,
        storageKey,
        sanitizedFilename: sanitizedName,
        mimeType,
        documentType: validDocType,
        access: 'private',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Document upload init error:', error);
    return NextResponse.json(
      { error: 'Internal server error during upload initialization' },
      { status: 500 }
    );
  }
}
