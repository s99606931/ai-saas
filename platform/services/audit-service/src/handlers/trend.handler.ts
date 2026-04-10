// 감사 로그 추이 및 이상 탐지 핸들러
// Design Ref: SVC-AUDIT-R2 DESIGN
// Plan SC: FR-AUDIT.3, FR-AUDIT.4
// CSAP: D-06 침해사고 관리 — 이상 행위 감지

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// C6-02: Zod 검증 스키마 (CSAP D-12)
const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  tenantId: z.string().optional(),
  action: z.string().optional(),
});

const anomalyQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
  tenantId: z.string().optional(),
  threshold: z.coerce.number().min(1.5).max(10).default(2),
});

/**
 * FR-AUDIT.3: 일별 감사 이벤트 추이
 * GET /audit/analytics/trend?days=7
 * Design Ref: SVC-AUDIT-R2 DESIGN
 */
export async function eventTrendHandler(
  request: FastifyRequest<{ Querystring: { days?: string; tenantId?: string; action?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = trendQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const { days, tenantId, action } = parseResult.data;

  const baseWhere: Record<string, unknown> = {};
  if (tenantId) baseWhere['tenantId'] = tenantId;
  if (action) baseWhere['action'] = action;

  const trend: { date: string; count: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const count = await prisma.auditLog.count({
      where: {
        ...baseWhere,
        createdAt: { gte: start, lt: end },
      },
    });

    trend.push({
      date: start.toISOString().slice(0, 10),
      count,
    });
  }

  await reply.send({
    success: true,
    data: {
      trend,
      totalEvents: trend.reduce((sum, t) => sum + t.count, 0),
      days,
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * FR-AUDIT.4: 이상 행위 탐지 (통계적 이상치)
 * GET /audit/analytics/anomalies?days=30&threshold=2
 * Design Ref: SVC-AUDIT-R2 DESIGN
 *
 * 일별 이벤트 수의 평균 + (threshold * 표준편차)를 초과하는 날짜를 이상치로 판별
 */
export async function anomalyDetectionHandler(
  request: FastifyRequest<{ Querystring: { days?: string; tenantId?: string; threshold?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = anomalyQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const { days, tenantId, threshold } = parseResult.data;

  const baseWhere: Record<string, unknown> = {};
  if (tenantId) baseWhere['tenantId'] = tenantId;

  // 일별 이벤트 수 수집
  const dailyCounts: { date: string; count: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const count = await prisma.auditLog.count({
      where: {
        ...baseWhere,
        createdAt: { gte: start, lt: end },
      },
    });

    dailyCounts.push({
      date: start.toISOString().slice(0, 10),
      count,
    });
  }

  // 통계 계산
  const counts = dailyCounts.map((d) => d.count);
  const mean = counts.length > 0
    ? counts.reduce((sum, c) => sum + c, 0) / counts.length
    : 0;
  const variance = counts.length > 0
    ? counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length
    : 0;
  const stddev = Math.sqrt(variance);
  const anomalyThreshold = mean + threshold * stddev;

  const anomalies = dailyCounts
    .filter((d) => d.count > anomalyThreshold)
    .map((d) => ({
      date: d.date,
      count: d.count,
      zScore: stddev > 0 ? Number(((d.count - mean) / stddev).toFixed(2)) : 0,
    }));

  await reply.send({
    success: true,
    data: {
      statistics: {
        mean: Number(mean.toFixed(2)),
        stddev: Number(stddev.toFixed(2)),
        anomalyThreshold: Number(anomalyThreshold.toFixed(2)),
        thresholdMultiplier: threshold,
      },
      anomalies,
      totalAnomalyDays: anomalies.length,
      analyzedDays: days,
      generatedAt: new Date().toISOString(),
    },
  });
}
