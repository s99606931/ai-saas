// Design Ref: DESIGN-MTU-U1-P
// Next.js 15 설정

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  env: {
    // 개발 환경 DB — 운영 환경은 .env.local 또는 플랫폼 환경 변수 사용
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://saas:saas_dev_2026@localhost:5432/saas_platform',
  },
};

export default nextConfig;
