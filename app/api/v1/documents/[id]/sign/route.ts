import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { generateKeyPair, signData } from '@/lib/security/digital-signature';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { jsonResponseWithRequestId } from '@/lib/observability/response';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'SIGN_DOCUMENT');
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
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!document || document.versions.length === 0) {
      return jsonResponseWithRequestId({ error: 'Document version not found' }, 404, requestId);
    }

    const currentVersion = document.versions[0];
    const keyPair = generateKeyPair();

    // Sign the version's SHA-256 hash
    const signatureBase64 = signData(currentVersion.sha256, keyPair.privateKey);

    const signatureRecord = await prisma.signature.create({
      data: {
        documentId: id,
        versionId: currentVersion.id,
        signerId: auth.user.id,
        algorithm: 'RSA-SHA256',
        signature: signatureBase64,
        publicKey: keyPair.publicKey,
        signedHash: currentVersion.sha256,
        verificationStatus: 'VALID',
      },
      include: {
        signer: {
          select: { id: true, fullName: true, email: true, department: true },
        },
      },
    });

    await logAuditEvent({
      userId: auth.user.id,
      documentId: id,
      action: AuditAction.SIGN_DOCUMENT,
      ipAddress,
      userAgent,
      metadata: {
        signatureId: signatureRecord.id,
        versionNumber: currentVersion.versionNumber,
        signedHash: currentVersion.sha256,
        algorithm: 'RSA-SHA256',
      },
    });

    return NextResponse.json(
      {
        message: 'Document signed successfully',
        signature: signatureRecord,
      },
      { status: 201, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    console.error('Sign Document API error:', error);
    return jsonResponseWithRequestId({ error: 'Internal server error signing document' }, 500, requestId);
  }
}
