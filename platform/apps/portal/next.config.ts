// Design Ref: DESIGN-MTU-U1-P
// Next.js 15 설정

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
