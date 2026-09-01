import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, canAccessDocument } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

const UpdateMetadataSchema = z.object({
  caseNumber: z.string().nullable().optional(),
  documentDate: z.string().nullable().optional(),
  policeStation: z.string().nullable().optional(),
  officer: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  persons: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  organizations: z.array(z.string()).optional(),
});

// GET /api/v1/documents/{id}/metadata - Get Document Metadata
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

    return NextResponse.json(
      {
        documentId: id,
        metadata: document.metadata || {
          caseNumber: null,
          documentDate: null,
          policeStation: null,
          officer: null,
          persons: [],
          locations: [],
          organizations: [],
          summary: 'No metadata available yet.',
          rawMetadata: {},
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Get Metadata API error:', error);
    return NextResponse.json({ error: 'Internal server error getting metadata' }, { status: 500 });
  }
}

// PATCH /api/v1/documents/{id}/metadata - Update Document Metadata
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';

  const auth = await authorizeRequest(req, 'EDIT_METADATA');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await canAccessDocument(auth.user.id, auth.user.roles, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = UpdateMetadataSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid metadata fields', details: parseResult.error.format() }, { status: 400 });
    }

    const { caseNumber, documentDate, policeStation, officer, summary, persons, locations, organizations } = parseResult.data;

    const existingMetadata = await prisma.documentMetadata.findUnique({ where: { documentId: id } });

    const updatedMetadata = await prisma.documentMetadata.upsert({
      where: { documentId: id },
      create: {
        documentId: id,
        caseNumber,
        documentDate,
        policeStation,
        officer,
        summary,
        persons: persons || [],
        locations: locations || [],
        organizations: organizations || [],
        updatedBy: auth.user.id,
      },
      update: {
        caseNumber,
        documentDate,
        policeStation,
        officer,
        summary,
        persons: persons !== undefined ? persons : (existingMetadata?.persons as any),
        locations: locations !== undefined ? locations : (existingMetadata?.locations as any),
        organizations: organizations !== undefined ? organizations : (existingMetadata?.organizations as any),
        updatedBy: auth.user.id,
      },
    });

    await logAuditEvent({
      userId: auth.user.id,
      documentId: id,
      action: AuditAction.EDIT_METADATA,
      ipAddress,
      userAgent,
      metadata: {
        oldFields: existingMetadata ? { caseNumber: existingMetadata.caseNumber, policeStation: existingMetadata.policeStation } : null,
        newFields: { caseNumber, policeStation, officer },
      },
    });

    return NextResponse.json(
      { message: 'Document metadata updated successfully', metadata: updatedMetadata },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update Metadata API error:', error);
    return NextResponse.json({ error: 'Internal server error updating metadata' }, { status: 500 });
  }
}
