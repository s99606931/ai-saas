// Design Ref: D-P00.6 §Prisma 클라이언트 싱글턴
// Plan SC: FR-P00.6
// CSAP: D-08 DB 접근 통제 — 단일 연결 풀 관리

import { PrismaClient } from '@prisma/client';

// Next.js 개발 환경에서 HMR로 인한 다중 인스턴스 생성 방지
// Production: 항상 새 인스턴스 (globalThis 캐시 미사용)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
