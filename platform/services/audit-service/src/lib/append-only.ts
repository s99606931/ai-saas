// Append-only 로그 구조
// Design Ref: DESIGN-MTU-P13
// Plan SC: FR-P13.1
// CSAP: D-06 — 감사 로그 수정/삭제 불가

import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

/**
 * 감사 로그 엔트리 추가 (append-only)
 *
 * CSAP D-06 요건:
 * - 기록된 로그는 수정/삭제 불가
 * - SHA-256 체인으로 무결성 보장
 * - 최소 1년 보존
 *
 * @param entry - 감사 로그 데이터
 */
export async function appendAuditLog(entry: {
  tenantId?: string;
  actorId?: string;
  action: string;
  target?: string;
  targetType?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // 이전 로그의 해시 조회 (체인 연결)
  const lastLog = await prisma.auditLog.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  });

  const previousHash = lastLog?.hash ?? '0'.repeat(64);

  // SHA-256 해시 계산
  const hashData = [
    entry.actorId ?? 'system',
    entry.action,
    entry.target ?? '',
    entry.targetType ?? '',
    entry.tenantId ?? 'system',
    new Date().toISOString(),
    previousHash,
  ].join('|');

  const hash = createHash('sha256').update(hashData).digest('hex');

  // append-only 삽입 (UPDATE/DELETE 트리거 없음)
  await prisma.auditLog.create({
    data: {
      ...entry,
      metadata: entry.metadata as Record<string, unknown> ?? null,
      hash,
      previousHash,
    } as Parameters<typeof prisma.auditLog.create>[0]['data'],
  });
}
