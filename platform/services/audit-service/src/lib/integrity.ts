// SHA-256 체인 무결성 검증
// Design Ref: DESIGN-MTU-P13
// Plan SC: FR-P13.2, FR-P13.4
// CSAP: D-06 — 감사 로그 무결성

import { createHash } from 'node:crypto';
import { prisma } from './prisma.js';

interface IntegrityResult {
  valid: boolean;
  totalEntries: number;
  checkedEntries: number;
  brokenAt?: string;
  brokenLogId?: string;
}

/**
 * 감사 로그 체인 무결성 검증
 *
 * 전체 감사 로그의 SHA-256 체인을 검증합니다.
 *
 * @param tenantId - 특정 테넌트 검증 (없으면 전체)
 * @param fromDate - 검증 시작 일시
 * @param toDate - 검증 종료 일시
 * @returns 무결성 검증 결과
 */
export async function verifyAuditLogIntegrity(
  tenantId?: string,
  fromDate?: Date,
  toDate?: Date,
): Promise<IntegrityResult> {
  const where: Record<string, unknown> = {};
  if (tenantId) where['tenantId'] = tenantId;
  if (fromDate || toDate) {
    where['createdAt'] = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      actorId: true,
      action: true,
      target: true,
      targetType: true,
      tenantId: true,
      createdAt: true,
      hash: true,
      previousHash: true,
    },
  });

  let previousHash = '0'.repeat(64);

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (!log) continue;

    // 체인 연결 검증
    if (i > 0 && log.previousHash !== previousHash) {
      return {
        valid: false,
        totalEntries: logs.length,
        checkedEntries: i + 1,
        brokenAt: log.createdAt.toISOString(),
        brokenLogId: log.id,
      };
    }

    // 해시 재계산
    const hashData = [
      log.actorId ?? 'system',
      log.action,
      log.target ?? '',
      log.targetType ?? '',
      log.tenantId ?? 'system',
      log.createdAt.toISOString(),
      log.previousHash,
    ].join('|');

    const recomputedHash = createHash('sha256').update(hashData).digest('hex');

    if (log.hash !== recomputedHash) {
      return {
        valid: false,
        totalEntries: logs.length,
        checkedEntries: i + 1,
        brokenAt: log.createdAt.toISOString(),
        brokenLogId: log.id,
      };
    }

    previousHash = log.hash;
  }

  return {
    valid: true,
    totalEntries: logs.length,
    checkedEntries: logs.length,
  };
}
