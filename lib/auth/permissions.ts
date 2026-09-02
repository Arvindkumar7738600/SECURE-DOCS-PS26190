import { RoleName } from '@prisma/client';

export type Permission =
  | 'CASE_CREATE'
  | 'CASE_READ'
  | 'CASE_UPDATE'
  | 'CASE_DELETE'
  | 'CASE_ASSIGN'
  | 'CASE_MEMBER_MANAGE'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_READ'
  | 'DOCUMENT_DOWNLOAD'
  | 'DOCUMENT_UPDATE'
  | 'DOCUMENT_DELETE'
  | 'DOCUMENT_PROCESS'
  | 'DOCUMENT_VERIFY'
  | 'EDIT_METADATA'
  | 'SEARCH'
  | 'SEARCH_AI'
  | 'AUDIT_READ'
  | 'AUDIT_VERIFY'
  | 'SHARE_CREATE'
  | 'SHARE_READ'
  | 'SHARE_REVOKE'
  | 'SIGN_DOCUMENT'
  | 'VERIFY_SIGNATURE'
  | 'USER_READ'
  | 'USER_MANAGE'
  | 'SYSTEM_ADMIN';

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  ADMIN: [
    'CASE_CREATE',
    'CASE_READ',
    'CASE_UPDATE',
    'CASE_DELETE',
    'CASE_ASSIGN',
    'CASE_MEMBER_MANAGE',
    'DOCUMENT_UPLOAD',
    'DOCUMENT_READ',
    'DOCUMENT_DOWNLOAD',
    'DOCUMENT_UPDATE',
    'DOCUMENT_DELETE',
    'DOCUMENT_PROCESS',
    'DOCUMENT_VERIFY',
    'EDIT_METADATA',
    'SEARCH',
    'SEARCH_AI',
    'AUDIT_READ',
    'AUDIT_VERIFY',
    'SHARE_CREATE',
    'SHARE_READ',
    'SHARE_REVOKE',
    'SIGN_DOCUMENT',
    'VERIFY_SIGNATURE',
    'USER_READ',
    'USER_MANAGE',
    'SYSTEM_ADMIN',
  ],

  INVESTIGATOR: [
    'CASE_CREATE',
    'CASE_READ',
    'CASE_UPDATE',
    'CASE_MEMBER_MANAGE',
    'DOCUMENT_UPLOAD',
    'DOCUMENT_READ',
    'DOCUMENT_DOWNLOAD',
    'DOCUMENT_UPDATE',
    'DOCUMENT_PROCESS',
    'DOCUMENT_VERIFY',
    'EDIT_METADATA',
    'SEARCH',
    'SEARCH_AI',
    'SHARE_CREATE',
    'SHARE_READ',
    'SHARE_REVOKE',
    'SIGN_DOCUMENT',
    'VERIFY_SIGNATURE',
  ],

  OFFICER: [
    'CASE_READ',
    'DOCUMENT_UPLOAD',
    'DOCUMENT_READ',
    'DOCUMENT_DOWNLOAD',
    'DOCUMENT_PROCESS',
    'DOCUMENT_VERIFY',
    'EDIT_METADATA',
    'SEARCH',
    'VERIFY_SIGNATURE',
  ],

  LEGAL: [
    'CASE_READ',
    'DOCUMENT_UPLOAD',
    'DOCUMENT_READ',
    'DOCUMENT_DOWNLOAD',
    'DOCUMENT_PROCESS',
    'DOCUMENT_VERIFY',
    'EDIT_METADATA',
    'SEARCH',
    'SEARCH_AI',
    'SHARE_CREATE',
    'SHARE_READ',
    'VERIFY_SIGNATURE',
  ],

  AUDITOR: [
    'CASE_READ',
    'DOCUMENT_READ',
    'DOCUMENT_VERIFY',
    'AUDIT_READ',
    'AUDIT_VERIFY',
    'VERIFY_SIGNATURE',
  ],

  VIEWER: [
    'CASE_READ',
    'DOCUMENT_READ',
    'SEARCH',
  ],
};

export function hasPermission(userRoles: (RoleName | string)[], permission: Permission): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.some((role) => {
    const roleName = role as RoleName;
    const permissions = ROLE_PERMISSIONS[roleName];
    return permissions ? permissions.includes(permission) : false;
  });
}
