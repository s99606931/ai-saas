// Design Ref: DESIGN-MTU-U1-P
// Next.js 15 설정

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // pnpm 모노레포에서 standalone 빌드 시 루트에서 파일 트레이싱
  outputFileTracingRoot: '/app',
  experimental: {
    typedRoutes: true,
  },
  env: {
    // 개발 환경 DB — 운영 환경은 .env.local 또는 플랫폼 환경 변수 사용
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://saas:saas_dev_2026@localhost:5432/saas_platform',
  },
};

export default nextConfig;
