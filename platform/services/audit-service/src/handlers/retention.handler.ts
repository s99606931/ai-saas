// 감사 로그 보존 정책 핸들러
// Design Ref: DESIGN-MTU-P13 §2.1
// Plan SC: FR-P13.5
// CSAP: D-06 — 최소 1년 보존

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

const RETENTION_DAYS = 365;

export async function retentionStatsHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const totalLogs = await prisma.auditLog.count();

  const oldestLog = await prisma.auditLog.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  const newestLog = await prisma.auditLog.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - RETENTION_DAYS);

  const expiredCount = await prisma.auditLog.count({
    where: { createdAt: { lt: retentionCutoff } },
  });

  await reply.send({
    retentionDays: RETENTION_DAYS,
    totalLogs,
    oldestLog: oldestLog?.createdAt?.toISOString() ?? null,
    newestLog: newestLog?.createdAt?.toISOString() ?? null,
    expiredCount,
    retentionCutoff: retentionCutoff.toISOString(),
  });
}

export async function retentionCleanupHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // CSAP D-06: 1년 보존 후 아카이브 (삭제가 아닌 아카이브 플래그)
  // 실제 환경에서는 아카이브 테이블로 이동
  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - RETENTION_DAYS);

  const expiredCount = await prisma.auditLog.count({
    where: { createdAt: { lt: retentionCutoff } },
  });

  await reply.send({
    message: '보존 기간 만료 로그 확인 완료',
    expiredCount,
    retentionCutoff: retentionCutoff.toISOString(),
    action: expiredCount > 0 ? '아카이브 테이블 이동 필요' : '정리 대상 없음',
  });
}
