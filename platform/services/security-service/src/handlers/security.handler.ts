// 보안 모니터링 핸들러
// Design Ref: DESIGN-MTU-P15 §2
// Plan SC: FR-P15.1~FR-P15.4
// CSAP: D-06 감사, D-10 네트워크 보안

import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logSecurityEvent } from '../lib/audit.js';

const prisma = new PrismaClient();

// --- IP 차단 목록 (In-memory + 영속 대비) ---
const ipBlocklist = new Map<string, { reason: string; blockedAt: string; expiresAt?: string }>();

// --- Zod 스키마 ---

const ipBlockSchema = z.object({
  ip: z.string().min(1, 'IP 주소는 필수입니다'),
  reason: z.string().min(1, '차단 사유는 필수입니다'),
  durationMinutes: z.number().int().positive().optional(),
});

// --- 핸들러 ---

/**
 * FR-P15.1: 로그인 실패 패턴 탐지
 * GET /security/login-failures
 *
 * 최근 N분 내 로그인 실패 5회 이상인 계정/IP를 탐지합니다.
 */
export async function loginFailuresHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const query = request.query as { minutes?: string; threshold?: string };
  const minutes = parseInt(query.minutes ?? '5', 10);
  const threshold = parseInt(query.threshold ?? '5', 10);

  const since = new Date();
  since.setMinutes(since.getMinutes() - minutes);

  const failures = await prisma.auditLog.groupBy({
    by: ['actorId', 'ip'],
    where: {
      action: 'LOGIN_FAILED',
      createdAt: { gte: since },
    },
    _count: { id: true },
    having: {
      id: { _count: { gte: threshold } },
    },
  });

  const alerts = failures.map((f) => ({
    actorId: f.actorId,
    ip: f.ip,
    failureCount: f._count.id,
    period: `${minutes}분`,
    severity: f._count.id >= 10 ? 'critical' : f._count.id >= 7 ? 'high' : 'medium',
  }));

  reply.send({
    alerts,
    totalAlerts: alerts.length,
    period: { minutes, threshold },
    checkedAt: new Date().toISOString(),
  });
}

/**
 * FR-P15.2: 이상 접근 패턴 탐지
 * GET /security/anomalies
 *
 * 동시 다중 IP 로그인, 비정상 시간대 접근, 단시간 대량 요청 등
 */
export async function anomaliesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const query = request.query as { hours?: string };
  const hours = parseInt(query.hours ?? '1', 10);

  const since = new Date();
  since.setHours(since.getHours() - hours);

  // 동일 사용자 다중 IP 접근 탐지
  const multiIpAccess = await prisma.auditLog.groupBy({
    by: ['actorId'],
    where: {
      action: { startsWith: 'LOGIN' },
      createdAt: { gte: since },
      actorId: { not: null },
    },
    _count: { id: true },
  });

  // 단시간 대량 요청 탐지 (IP 기준)
  const highVolume = await prisma.auditLog.groupBy({
    by: ['ip'],
    where: {
      createdAt: { gte: since },
      ip: { not: null },
    },
    _count: { id: true },
    having: {
      id: { _count: { gte: 100 } },
    },
  });

  const anomalies = [
    ...highVolume.map((h) => ({
      type: 'HIGH_VOLUME_REQUEST',
      ip: h.ip,
      count: h._count.id,
      severity: h._count.id >= 500 ? 'critical' : 'high',
    })),
  ];

  reply.send({
    anomalies,
    totalAnomalies: anomalies.length,
    period: { hours },
    checkedAt: new Date().toISOString(),
  });
}

/**
 * FR-P15.3: IP 차단 목록 조회
 * GET /security/ip-blocklist
 */
export async function getIpBlocklistHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const now = new Date().toISOString();
  const entries = Array.from(ipBlocklist.entries())
    .filter(([, v]) => !v.expiresAt || v.expiresAt > now)
    .map(([ip, v]) => ({ ip, ...v }));

  reply.send({ entries, total: entries.length });
}

/**
 * FR-P15.3: IP 차단 등록
 * POST /security/ip-blocklist
 */
export async function addIpBlocklistHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = ipBlockSchema.parse(request.body);
  const blockedAt = new Date().toISOString();
  const expiresAt = body.durationMinutes
    ? new Date(Date.now() + body.durationMinutes * 60 * 1000).toISOString()
    : undefined;

  ipBlocklist.set(body.ip, { reason: body.reason, blockedAt, expiresAt });

  await logSecurityEvent('IP_BLOCKED', { ip: body.ip, reason: body.reason });

  reply.status(201).send({
    success: true,
    ip: body.ip,
    blockedAt,
    expiresAt: expiresAt ?? 'permanent',
  });
}

/**
 * FR-P15.3: IP 차단 해제
 * DELETE /security/ip-blocklist/:ip
 */
export async function removeIpBlocklistHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { ip } = request.params as { ip: string };

  if (!ipBlocklist.has(ip)) {
    reply.status(404).send({ error: '차단 목록에 없는 IP입니다' });
    return;
  }

  ipBlocklist.delete(ip);
  await logSecurityEvent('IP_UNBLOCKED', { ip });

  reply.send({ success: true, ip, message: 'IP 차단 해제 완료' });
}

/**
 * FR-P15.4: 보안 이벤트 알림 목록
 * GET /security/alerts
 */
export async function securityAlertsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const query = request.query as { severity?: string; limit?: string };
  const limit = parseInt(query.limit ?? '20', 10);

  const where: Record<string, unknown> = {
    action: {
      in: [
        'LOGIN_FAILED',
        'IP_BLOCKED',
        'AI_GRADE_VIOLATION',
        'UNAUTHORIZED_ACCESS',
        'SESSION_HIJACK_ATTEMPT',
      ],
    },
  };

  const alerts = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      actorId: true,
      ip: true,
      metadata: true,
      createdAt: true,
    },
  });

  reply.send({
    alerts: alerts.map((a) => ({
      ...a,
      severity: a.action === 'AI_GRADE_VIOLATION' || a.action === 'SESSION_HIJACK_ATTEMPT'
        ? 'critical'
        : a.action === 'IP_BLOCKED'
          ? 'high'
          : 'medium',
    })),
    total: alerts.length,
  });
}
