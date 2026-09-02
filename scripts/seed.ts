import { PrismaClient, RoleName, CaseStatus, CasePriority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed (SYNTHETIC DEMONSTRATION DATA ONLY)...');

  // 1. Roles Seed
  const roleNames: RoleName[] = [
    RoleName.ADMIN,
    RoleName.INVESTIGATOR,
    RoleName.OFFICER,
    RoleName.LEGAL,
    RoleName.AUDITOR,
    RoleName.VIEWER,
  ];

  const roleMap: Record<string, string> = {};

  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roleMap[name] = role.id;
  }
  console.log('✅ Roles seeded:', Object.keys(roleMap).length);

  // 2. Demo Users Seed
  const passwordHash = await bcrypt.hash('DemoPass123!', 10);

  const demoUsers = [
    {
      email: 'admin@example.com',
      fullName: 'System Administrator',
      department: 'Central IT Administration',
      role: RoleName.ADMIN,
    },
    {
      email: 'investigator@example.com',
      fullName: 'Senior Investigator Inspector Sharma',
      department: 'Special Crime Branch - Financial Frauds',
      role: RoleName.INVESTIGATOR,
    },
    {
      email: 'officer@example.com',
      fullName: 'Sub-Inspector Officer Verma',
      department: 'Cyber Crime Cell',
      role: RoleName.OFFICER,
    },
    {
      email: 'legal@example.com',
      fullName: 'Legal Counsel Advocate Kapoor',
      department: 'Directorate of Prosecution',
      role: RoleName.LEGAL,
    },
    {
      email: 'auditor@example.com',
      fullName: 'Chief Auditor Audit Officer Roy',
      department: 'Internal Vigilance & Audit Bureau',
      role: RoleName.AUDITOR,
    },
    {
      email: 'viewer@example.com',
      fullName: 'Case Viewer Desk Officer Gupta',
      department: 'Judicial Records Division',
      role: RoleName.VIEWER,
    },
  ];

  const userMap: Record<string, string> = {};

  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        department: u.department,
        passwordHash,
      },
      create: {
        email: u.email,
        passwordHash,
        fullName: u.fullName,
        department: u.department,
        isActive: true,
        mfaEnabled: false,
      },
    });

    userMap[u.email] = user.id;

    // Assign Role
    const roleId = roleMap[u.role];
    if (roleId) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId,
        },
      });
    }
  }
  console.log('✅ Demo Users seeded:', Object.keys(userMap).length);

  // 3. Synthetic Demo Cases Seed
  const demoCases = [
    {
      caseNumber: 'CASE-2026-001',
      title: 'Financial Fraud Investigation [SYNTHETIC DEMONSTRATION DATA]',
      description: 'Synthetic demonstration case regarding alleged unauthorized multi-bank transfers and illegal offshore transactions.',
      caseType: 'FINANCIAL_CRIME',
      status: CaseStatus.UNDER_INVESTIGATION,
      priority: CasePriority.HIGH,
      department: 'Special Crime Branch - Financial Frauds',
      creatorEmail: 'admin@example.com',
    },
    {
      caseNumber: 'CASE-2026-002',
      title: 'Cyber Crime Investigation [SYNTHETIC DEMONSTRATION DATA]',
      description: 'Synthetic demonstration case investigating unauthorized server access and ransomware dissemination across regional legal servers.',
      caseType: 'CYBER_CRIME',
      status: CaseStatus.OPEN,
      priority: CasePriority.CRITICAL,
      department: 'Cyber Crime Cell',
      creatorEmail: 'admin@example.com',
    },
    {
      caseNumber: 'CASE-2026-003',
      title: 'Missing Person Investigation [SYNTHETIC DEMONSTRATION DATA]',
      description: 'Synthetic demonstration case involving multi-state trace and digital footprint analysis of missing witness.',
      caseType: 'MISSING_PERSON',
      status: CaseStatus.PENDING_REVIEW,
      priority: CasePriority.MEDIUM,
      department: 'Judicial Records Division',
      creatorEmail: 'investigator@example.com',
    },
  ];

  for (const c of demoCases) {
    const creatorId = userMap[c.creatorEmail];
    if (!creatorId) continue;

    const createdCase = await prisma.case.upsert({
      where: { caseNumber: c.caseNumber },
      update: {
        title: c.title,
        description: c.description,
        status: c.status,
        priority: c.priority,
      },
      create: {
        caseNumber: c.caseNumber,
        title: c.title,
        description: c.description,
        caseType: c.caseType,
        status: c.status,
        priority: c.priority,
        department: c.department,
        createdBy: creatorId,
      },
    });

    // Assign Case Members
    const investigatorId = userMap['investigator@example.com'];
    if (investigatorId) {
      await prisma.caseMember.upsert({
        where: {
          caseId_userId: {
            caseId: createdCase.id,
            userId: investigatorId,
          },
        },
        update: {},
        create: {
          caseId: createdCase.id,
          userId: investigatorId,
          role: RoleName.INVESTIGATOR,
        },
      });
    }

    const officerId = userMap['officer@example.com'];
    if (officerId) {
      await prisma.caseMember.upsert({
        where: {
          caseId_userId: {
            caseId: createdCase.id,
            userId: officerId,
          },
        },
        update: {},
        create: {
          caseId: createdCase.id,
          userId: officerId,
          role: RoleName.OFFICER,
        },
      });
    }
  }

  console.log('✅ Demo Cases seeded: 3');
  console.log('🎉 Seed process completed cleanly!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
