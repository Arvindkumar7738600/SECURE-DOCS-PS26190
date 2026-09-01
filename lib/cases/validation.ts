import { z } from 'zod';
import { CaseStatus, CasePriority, RoleName } from '@prisma/client';

export const CreateCaseSchema = z.object({
  caseNumber: z
    .string()
    .min(3, 'Case number must be at least 3 characters long')
    .max(50, 'Case number cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Case number must contain only letters, numbers, hyphens, and underscores'),
  title: z.string().min(2, 'Title must be at least 2 characters long').max(200),
  description: z.string().min(1, 'Description is required'),
  caseType: z.string().min(1, 'Case type is required'),
  status: z.nativeEnum(CaseStatus).optional().default(CaseStatus.OPEN),
  priority: z.nativeEnum(CasePriority).optional().default(CasePriority.MEDIUM),
  department: z.string().min(1, 'Department is required'),
});

export const UpdateCaseSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(5).optional(),
  caseType: z.string().min(2).optional(),
  status: z.nativeEnum(CaseStatus).optional(),
  priority: z.nativeEnum(CasePriority).optional(),
  department: z.string().min(2).optional(),
});

export const AddCaseMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.nativeEnum(RoleName).optional().default(RoleName.INVESTIGATOR),
});

export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;
export type UpdateCaseInput = z.infer<typeof UpdateCaseSchema>;
export type AddCaseMemberInput = z.infer<typeof AddCaseMemberSchema>;
