// CSP nonce 미들웨어 — unsafe-inline 제거
// Design Ref: L-04-CSP-NONCE.design.md §1
// Plan SC: FR-L04.1, FR-L04.2
// CSAP: D-12 시스템 개발 보안 — XSS 방지 CSP 강화

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // FR-L04.1: crypto nonce 생성 (요청마다 고유)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // FR-L04.2: CSP 정책 구성 (unsafe-inline 제거, nonce 기반)
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'", // FR-L04.3: CSS-in-JS(Tailwind) 지원
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' http://localhost:* ws://localhost:*",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  const cspHeader = cspDirectives.join('; ');

  // 요청 헤더에 nonce 주입 (layout.tsx에서 읽기)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 응답에 보안 헤더 설정
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  response.headers.set('X-XSS-Protection', '0');

  // 프로덕션에서만 HSTS
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

// 정적 리소스 제외
export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header' as const, key: 'next-router-prefetch' },
        { type: 'header' as const, key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
