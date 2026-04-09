// Design Ref: DESIGN-MTU-U1-P
// Plan SC: FR-U1-P.12 (보안 헤더)
// CSAP: D-12 시스템 개발 보안 — 보안 헤더 설정
// Next.js 15 설정

import type { NextConfig } from 'next';

/**
 * 보안 헤더 (CSAP D-12, OWASP Top10 대응)
 * - Content-Security-Policy: XSS 방지 (인라인 스크립트 차단)
 * - X-Frame-Options: 클릭재킹 방지
 * - X-Content-Type-Options: MIME 스니핑 방지
 * - Referrer-Policy: 리퍼러 정보 최소화
 * - X-DNS-Prefetch-Control: DNS 프리페치 제한
 * - Strict-Transport-Security: HTTPS 강제 (운영 환경)
 * - Permissions-Policy: 불필요한 브라우저 기능 비활성화
 */
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-eval 제거 (H-03 수정): Next.js 15 프로덕션 빌드는 eval() 불필요
      // CSS-in-JS(Tailwind 인라인) 지원을 위해 unsafe-inline만 유지
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'", // 인라인 스타일 (CSS-in-JS)
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' http://localhost:* ws://localhost:*",
      "frame-ancestors 'none'", // 클릭재킹 방지 (X-Frame-Options 보완)
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'off',
  },
  // L-01 수정: HSTS는 프로덕션에서만 적용 (개발 환경 HTTP 충돌 방지)
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // pnpm 모노레포에서 standalone 빌드 시 루트에서 파일 트레이싱
  outputFileTracingRoot: '/app',
  experimental: {
    typedRoutes: true,
  },
  // C-02 수정: DATABASE_URL은 서버 전용 환경변수. Next.js env 섹션에 두면
  // 클라이언트 번들(window.__NEXT_DATA__)에 노출됨. process.env로 서버에서만 참조.
  // .env.local 또는 플랫폼 환경변수로 DATABASE_URL을 설정할 것.
  // CSAP D-12: 보안 헤더 전역 적용
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  // X-Powered-By 헤더 제거 (서버 정보 노출 방지)
  poweredByHeader: false,
};

export default nextConfig;
