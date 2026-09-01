import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/security/jwt';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';

const PROTECTED_ROUTES = [
  '/dashboard',
  '/cases',
  '/documents',
  '/search',
  '/audit',
  '/sharing',
  '/signatures',
  '/users',
  '/settings',
  '/profile',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if pathname starts with any protected route prefix
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedRoute) {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', encodeURIComponent(pathname));
      return NextResponse.redirect(loginUrl);
    }

    const payload = await verifyJWT(token);

    if (!payload) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', encodeURIComponent(pathname));
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/cases/:path*',
    '/documents/:path*',
    '/search/:path*',
    '/audit/:path*',
    '/sharing/:path*',
    '/signatures/:path*',
    '/users/:path*',
    '/settings/:path*',
    '/profile/:path*',
  ],
};
