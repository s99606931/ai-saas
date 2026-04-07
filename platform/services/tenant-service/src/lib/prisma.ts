// PrismaClient ���글턴
// Design Ref: DESIGN-MTU-P00 §DB 접근
// CSAP: D-08 DB 접근 통제 -- 단일 연결 풀 관리

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
