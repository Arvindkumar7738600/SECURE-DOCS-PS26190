import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/security/jwt';
import { prisma } from '@/lib/db/prisma';

export const AUTH_COOKIE_NAME = 'auth_token';

export interface UserSession {
  id: string;
  email: string;
  fullName: string;
  department: string;
  isActive: boolean;
  mfaEnabled: boolean;
  roles: string[];
  createdAt: Date;
}

export async function getSessionToken(req?: NextRequest): Promise<string | null> {
  if (req) {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (token) return token;
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
  const cookieStore = cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value || null;
}

export async function getCurrentUser(req?: NextRequest): Promise<UserSession | null> {
  const token = await getSessionToken(req);
  if (!token) return null;

  const payload = await verifyJWT(token);
  if (!payload || !payload.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    department: user.department,
    isActive: user.isActive,
    mfaEnabled: user.mfaEnabled,
    roles: user.userRoles.map((ur) => ur.role.name),
    createdAt: user.createdAt,
  };
}
