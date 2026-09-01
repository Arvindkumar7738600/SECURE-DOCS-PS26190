import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/authorization';
import { CreateCaseSchema } from '@/lib/cases/validation';
import { prisma } from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction, RoleName, CaseStatus, CasePriority, Prisma } from '@prisma/client';
import { getOrCreateRequestId, requestIdHeader } from '@/lib/observability/request-id';
import { safeError } from '@/lib/observability/safe-logger';

export const dynamic = 'force-dynamic';

const ALLOWED_SORT_FIELDS: Record<string, string> = {
  created_at: 'createdAt',
  createdAt: 'createdAt',
  updated_at: 'updatedAt',
  updatedAt: 'updatedAt',
  case_number: 'caseNumber',
  caseNumber: 'caseNumber',
  priority: 'priority',
};

// POST /api/v1/cases - Create Case
export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Internal';
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));

  const auth = await authorizeRequest(req, 'CASE_CREATE');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  try {
    const body = await req.json();
    const parseResult = CreateCaseSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { caseNumber, title, description, caseType, status, priority, department } = parseResult.data;

    // Check case_number uniqueness
    const existingCase = await prisma.case.findUnique({
      where: { caseNumber },
    });

    if (existingCase) {
      return NextResponse.json(
        { error: `Case with case number "${caseNumber}" already exists` },
        { status: 409 }
      );
    }

    const creatorRole = (auth.user.roles[0] as RoleName) || RoleName.INVESTIGATOR;

    // Transaction: Create Case + Initial Creator Membership
    const newCase = await prisma.$transaction(async (tx) => {
      const created = await tx.case.create({
        data: {
          caseNumber,
          title,
          description,
          caseType,
          status,
          priority,
          department,
          createdBy: auth.user!.id,
        },
      });

      await tx.caseMember.create({
        data: {
          caseId: created.id,
          userId: auth.user!.id,
          role: creatorRole,
        },
      });

      return created;
    });

    // Audit Event
    await logAuditEvent({
      userId: auth.user.id,
      caseId: newCase.id,
      action: AuditAction.CREATE_CASE,
      ipAddress,
      userAgent,
      requestId,
      metadata: { caseNumber: newCase.caseNumber, title: newCase.title },
    });

    return NextResponse.json(
      {
        message: 'Case created successfully',
        case: newCase,
      },
      { status: 201, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('Create Case API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error during case creation' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}

// GET /api/v1/cases - List, Search, Filter & Paginate Cases
export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get(requestIdHeader()));
  const auth = await authorizeRequest(req, 'CASE_READ');
  if (!auth.authorized || !auth.user) {
    return auth.errorResponse || NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { [requestIdHeader()]: requestId } }
    );
  }

  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const rawLimit = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(100, Math.max(1, rawLimit)); // Safe maximum 100
    const skip = (page - 1) * limit;

    const query = searchParams.get('q')?.trim();
    const statusParam = searchParams.get('status')?.toUpperCase();
    const priorityParam = searchParams.get('priority')?.toUpperCase();
    const caseTypeParam = searchParams.get('case_type') || searchParams.get('caseType');
    const departmentParam = searchParams.get('department');
    const sortByParam = searchParams.get('sortBy') || 'createdAt';
    const sortOrderParam = searchParams.get('sortOrder')?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const sortField = ALLOWED_SORT_FIELDS[sortByParam] || 'createdAt';

    // Base WHERE conditions
    const whereConditions: Prisma.CaseWhereInput[] = [];

    // Server-Side RBAC Scope Filter
    const isAdminOrAuditor = auth.user.roles.includes(RoleName.ADMIN) || auth.user.roles.includes(RoleName.AUDITOR);
    if (!isAdminOrAuditor) {
      whereConditions.push({
        OR: [
          { createdBy: auth.user.id },
          { members: { some: { userId: auth.user.id } } },
        ],
      });
    }

    // Search query filter
    if (query) {
      whereConditions.push({
        OR: [
          { caseNumber: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { department: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    // Filters
    if (statusParam && Object.values(CaseStatus).includes(statusParam as CaseStatus)) {
      whereConditions.push({ status: statusParam as CaseStatus });
    }
    if (priorityParam && Object.values(CasePriority).includes(priorityParam as CasePriority)) {
      whereConditions.push({ priority: priorityParam as CasePriority });
    }
    if (caseTypeParam) {
      whereConditions.push({ caseType: { equals: caseTypeParam, mode: 'insensitive' } });
    }
    if (departmentParam) {
      whereConditions.push({ department: { contains: departmentParam, mode: 'insensitive' } });
    }

    const where: Prisma.CaseWhereInput = whereConditions.length > 0 ? { AND: whereConditions } : {};

    const [total, cases] = await prisma.$transaction([
      prisma.case.count({ where }),
      prisma.case.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sortOrderParam },
        include: {
          creator: {
            select: { id: true, fullName: true, email: true, department: true },
          },
          _count: {
            select: { members: true, documents: true },
          },
        },
      }),
    ]);

    return NextResponse.json(
      {
        cases,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200, headers: { [requestIdHeader()]: requestId } }
    );
  } catch (error: any) {
    safeError('List Cases API error', error, requestId);
    return NextResponse.json(
      { error: 'Internal server error listing cases' },
      { status: 500, headers: { [requestIdHeader()]: requestId } }
    );
  }
}
