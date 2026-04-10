// Design Ref: DESIGN-MTU-U1-P
// Plan SC: FR-U1-P.12 (보안 헤더)
// CSAP: D-12 시스템 개발 보안 — 보안 헤더 설정
// Next.js 15 설정

import type { NextConfig } from 'next';

// NOTE: 보안 헤더(CSP, X-Frame-Options 등)는 middleware.ts로 이전 (L-04)
// nonce 기반 CSP는 요청마다 동적 생성이 필요하여 middleware에서 처리
// Design Ref: L-04-CSP-NONCE.design.md §1

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
  // NOTE: headers() 제거 — CSP nonce는 middleware.ts에서 동적 설정 (L-04)
  // X-Powered-By 헤더 제거 (서버 정보 노출 방지)
  poweredByHeader: false,
};

export default nextConfig;
