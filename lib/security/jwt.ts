import { SignJWT, jwtVerify, JWTPayload } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'super_secret_jwt_auth_key_sih_2026_prototype';
const secretKey = new TextEncoder().encode(JWT_SECRET);

export interface AuthJWTPayload extends JWTPayload {
  sub: string; // User ID
  email: string;
  roles: string[];
  purpose?: string;
}

export async function signJWT(payload: { sub: string; email: string; roles: string[] }, expiresIn: string = '8h'): Promise<string> {
  return new SignJWT({
    email: payload.email,
    roles: payload.roles,
    purpose: 'authenticated_session',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

export async function signMfaChallengeToken(userId: string, email: string): Promise<string> {
  return new SignJWT({
    email,
    purpose: 'mfa_challenge',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secretKey);
}

export async function verifyJWT(token: string): Promise<AuthJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    // Reject challenge tokens for normal session verification
    if (payload.purpose === 'mfa_challenge') {
      return null;
    }
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      roles: (payload.roles as string[]) || [],
      purpose: payload.purpose as string,
      ...payload,
    };
  } catch (err) {
    return null;
  }
}

export async function verifyMfaChallengeToken(token: string): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (payload.purpose !== 'mfa_challenge') {
      return null;
    }
    return {
      sub: payload.sub as string,
      email: payload.email as string,
    };
  } catch (err) {
    return null;
  }
}
