// 감사 로그 서비스 핸들러
// Design Ref: DESIGN-MTU-P13 §2.1
// Plan SC: FR-P13.1~FR-P13.6
// CSAP: D-06 — 감사 로그 기록/조회/검증/내보내기/보존

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { appendAuditLog } from '../lib/append-only.js';
import { verifyAuditLogIntegrity } from '../lib/integrity.js';
import { prisma } from '../lib/prisma.js';

// 내보내기 최대 조회 건수 (CSAP D-06: 대량 로그 내보내기 시 메모리 보호)
const EXPORT_MAX_RECORDS = 10000;

// --- Zod 스키마 ---

const createAuditLogSchema = z.object({
  tenantId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().min(1, 'action은 필수입니다'),
  target: z.string().optional(),
  targetType: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const queryAuditLogSchema = z.object({
  tenantId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const verifySchema = z.object({
  tenantId: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

const exportSchema = z.object({
  tenantId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  format: z.enum(['csv', 'json']).default('json'),
});

const statsQuerySchema = z.object({
  tenantId: z.string().optional(),
});

// --- 핸들러 ---

/**
 * FR-P13.1: 감사 로그 기록 (append-only)
 * POST /audit/logs
 */
export async function createAuditLogHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: safeParse로 입력 검증 (에러 시 스택 트레이스 미노출)
  const parsed = createAuditLogSchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  await appendAuditLog(parsed.data);
  await reply.status(201).send({ success: true, message: '감사 로그 기록 완료' });
}

/**
 * FR-P13.3: 감사 로그 조회 (필터, 페이지네이션)
 * GET /audit/logs
 */
export async function listAuditLogsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: safeParse로 입력 검증
  const parseResult = queryAuditLogSchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const query = parseResult.data;

  const where: Record<string, unknown> = {};
  if (query.tenantId) where['tenantId'] = query.tenantId;
  if (query.actorId) where['actorId'] = query.actorId;
  if (query.action) where['action'] = query.action;
  if (query.targetType) where['targetType'] = query.targetType;
  if (query.fromDate || query.toDate) {
    where['createdAt'] = {
      ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
      ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasNext = logs.length > query.limit;
  const items = hasNext ? logs.slice(0, query.limit) : logs;
  const nextCursor = hasNext ? items[items.length - 1]?.id : undefined;

  await reply.send({
    items,
    pagination: {
      limit: query.limit,
      hasNext,
      nextCursor,
    },
  });
}

/**
 * FR-P13.2, FR-P13.4: SHA-256 체인 무결성 검증
 * POST /audit/verify
 */
export async function verifyIntegrityHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: safeParse로 입력 검증
  const parsed = verifySchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const body = parsed.data;
  const result = await verifyAuditLogIntegrity(
    body.tenantId,
    body.fromDate ? new Date(body.fromDate) : undefined,
    body.toDate ? new Date(body.toDate) : undefined,
  );
  await reply.send(result);
}

/**
 * FR-P13.6: 감사 로그 내보내기 (CSV, JSON)
 * GET /audit/export
 */
export async function exportAuditLogsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: safeParse로 입력 검증
  const parseResult = exportSchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const query = parseResult.data;

  const where: Record<string, unknown> = {};
  if (query.tenantId) where['tenantId'] = query.tenantId;
  if (query.actorId) where['actorId'] = query.actorId;
  if (query.action) where['action'] = query.action;
  if (query.fromDate || query.toDate) {
    where['createdAt'] = {
      ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
      ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: EXPORT_MAX_RECORDS,
  });

  if (query.format === 'csv') {
    const header = 'id,tenantId,actorId,action,target,targetType,ip,userAgent,hash,createdAt';
    const rows = logs.map((log: (typeof logs)[number]) =>
      [
        log.id,
        log.tenantId ?? '',
        log.actorId ?? '',
        log.action,
        log.target ?? '',
        log.targetType ?? '',
        log.ip ?? '',
        `"${(log.userAgent ?? '').replace(/"/g, '""')}"`,
        log.hash,
        log.createdAt.toISOString(),
      ].join(','),
    );
    const csv = [header, ...rows].join('\n');
    await reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename=audit-logs.csv')
      .send(csv);
  } else {
    const jsonLines = logs.map((log: (typeof logs)[number]) => JSON.stringify(log)).join('\n');
    await reply
      .header('Content-Type', 'application/x-ndjson; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename=audit-logs.jsonl')
      .send(jsonLines);
  }
}

/**
 * FR-P13.5: 감사 로그 통계 (보존 현황)
 * GET /audit/stats
 */
export async function auditStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: safeParse로 쿼리 파라미터 검증
  const parseResult = statsQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const tenantId = parseResult.data.tenantId;

  const where: Record<string, unknown> = {};
  if (tenantId) where['tenantId'] = tenantId;

  const totalCount = await prisma.auditLog.count({ where });

  const retentionDays = 365;
  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - retentionDays);

  const oldestLog = await prisma.auditLog.findFirst({
    where,
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  const newestLog = await prisma.auditLog.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  const expiredCount = await prisma.auditLog.count({
    where: {
      ...where,
      createdAt: { lt: retentionCutoff },
    },
  });

  await reply.send({
    totalCount,
    retentionDays,
    retentionCutoff: retentionCutoff.toISOString(),
    oldestLog: oldestLog?.createdAt?.toISOString() ?? null,
    newestLog: newestLog?.createdAt?.toISOString() ?? null,
    expiredCount,
    activeCount: totalCount - expiredCount,
  });
}
