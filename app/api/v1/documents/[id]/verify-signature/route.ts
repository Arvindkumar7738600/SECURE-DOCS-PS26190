import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { verifyDataSignature } from '@/lib/security/digital-signature';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { jsonResponseWithRequestId } from '@/lib/observability/response';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'VERIFY_SIGNATURE');
  if (!auth.authorized || !auth.user) {
    return jsonResponseWithRequestId({ error: 'Unauthorized' }, 401, requestId);
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return jsonResponseWithRequestId({ error: 'Document not found or access denied' }, 404, requestId);
    }

    let signatureId: string | undefined;
    try {
      const body = await req.json();
      signatureId = body.signatureId;
    } catch {
      // Body optional
    }

    let signatureRecord;
    if (signatureId) {
      signatureRecord = await prisma.signature.findFirst({
        where: { id: signatureId, documentId: id },
        include: { version: true },
      });
    } else {
      signatureRecord = await prisma.signature.findFirst({
        where: { documentId: id },
        orderBy: { createdAt: 'desc' },
        include: { version: true },
      });
    }

    if (!signatureRecord) {
      return jsonResponseWithRequestId({ error: 'No signature record found for document' }, 404, requestId);
    }

    // 1. Check if hash matches current version hash
    const isHashMatching = signatureRecord.signedHash === signatureRecord.version.sha256;

    // 2. Perform RSA cryptographic signature verification
    const isCryptoValid = verifyDataSignature(
      signatureRecord.version.sha256,
      signatureRecord.signature,
      signatureRecord.publicKey
    );

    const overallValid = isHashMatching && isCryptoValid;
    const newStatus = overallValid ? 'VALID' : 'INVALID';

    if (signatureRecord.verificationStatus !== newStatus) {
      await prisma.signature.update({
        where: { id: signatureRecord.id },
        data: { verificationStatus: newStatus },
      });
    }

    return NextResponse.json(
      {
        signatureId: signatureRecord.id,
        verificationStatus: newStatus,
        isHashMatching,
        isCryptoValid,
        signedHash: signatureRecord.signedHash,
        currentVersionHash: signatureRecord.version.sha256,
        signedAt: signatureRecord.createdAt,
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    console.error('Verify Signature API error:', error);
    return jsonResponseWithRequestId({ error: 'Internal server error verifying signature' }, 500, requestId);
  }
}
