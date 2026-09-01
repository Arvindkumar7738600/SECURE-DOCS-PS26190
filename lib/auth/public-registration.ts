import { RoleName } from '@prisma/client';

export const PUBLIC_REGISTRATION_ROLE = RoleName.VIEWER;

export function getPublicRegistrationRole(): RoleName {
  return PUBLIC_REGISTRATION_ROLE;
}

