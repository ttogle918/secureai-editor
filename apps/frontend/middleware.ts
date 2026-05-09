import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// /editor 경로: refresh_token 쿠키 없으면 /login으로 리다이렉트
// 실제 토큰 유효성은 클라이언트에서 initAuth()가 검증한다.
export function middleware(request: NextRequest) {
  const hasRefreshToken = request.cookies.has('refresh_token');

  if (!hasRefreshToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/editor/:path*', '/settings/:path*'],
};
