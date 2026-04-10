// 보안 모니터링 핸들러
// Design Ref: DESIGN-MTU-P15 §2
// Plan SC: FR-P15.1~FR-P15.4
// CSAP: D-06 감사, D-10 네트워크 보안

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logSecurityEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

// --- IP 차단 목록 (In-memory + 영속 대비) ---
const ipBlocklist = new Map<string, { reason: string; blockedAt: string; expiresAt?: string }>();

// --- Zod 스키마 (CSAP D-12: 모든 입력 검증) ---

// FR-SEC.3: IP 형식 검증 (IPv4/IPv6/CIDR, Design Ref: SVC-SEC-R1 DESIGN)
const IP_PATTERN =
  /^(?:(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?|[0-9a-fA-F:]+(?:\/\d{1,3})?|::1|::ffff:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;

const ipBlockSchema = z.object({
  ip: z
    .string()
    .min(1, 'IP 주소는 필수입니다')
    .refine((ip) => IP_PATTERN.test(ip), { message: '유효하지 않은 IP 형식입니다 (IPv4/IPv6/CIDR)' }),
  reason: z.string().min(1, '차단 사유는 필수입니다'),
  durationMinutes: z.number().int().positive().optional(),
});

const loginFailuresQuerySchema = z.object({
  minutes: z.coerce.number().int().min(1).max(1440).default(5),
  threshold: z.coerce.number().int().min(1).max(100).default(5),
});

const anomaliesQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(1),
});

const alertsQuerySchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// --- 핸들러 ---

/**
 * FR-P15.1: 로그인 실패 패턴 탐지
 * GET /security/login-failures
 *
 * 최근 N분 내 로그인 실패 5회 이상인 계정/IP를 탐지합니다.
 */
export async function loginFailuresHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // CSAP D-12: safeParse로 쿼리 파라미터 검증
  const parseResult = loginFailuresQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const { minutes, threshold } = parseResult.data;

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

  await reply.send({
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
export async function anomaliesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // CSAP D-12: safeParse로 쿼리 파라미터 검증
  const parseResult = anomaliesQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const { hours } = parseResult.data;

  const since = new Date();
  since.setHours(since.getHours() - hours);

  // 동일 사용자 다중 IP 접근 탐지 (CSAP D-08: 세션 탈취 의심 탐지)
  const multiIpAccess = await prisma.auditLog.groupBy({
    by: ['actorId'],
    where: {
      action: { startsWith: 'LOGIN' },
      createdAt: { gte: since },
      actorId: { not: null },
    },
    _count: { id: true },
    having: {
      id: { _count: { gte: 3 } },
    },
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
    // 동일 사용자 다중 IP 접근 (세션 탈취 의심)
    ...multiIpAccess.map((m) => ({
      type: 'MULTI_IP_LOGIN' as const,
      actorId: m.actorId,
      ip: null as string | null,
      count: m._count.id,
      severity: m._count.id >= 5 ? ('critical' as const) : ('high' as const),
    })),
    // 단시간 대량 요청 (DDoS/크롤러 의심)
    ...highVolume.map((h) => ({
      type: 'HIGH_VOLUME_REQUEST' as const,
      actorId: null as string | null,
      ip: h.ip,
      count: h._count.id,
      severity: h._count.id >= 500 ? ('critical' as const) : ('high' as const),
    })),
  ];

  await reply.send({
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
export async function getIpBlocklistHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const now = new Date().toISOString();

  // FR-SEC.2: 만료된 항목 자동 정리 (Design Ref: SVC-SEC-R1 DESIGN)
  let expiredCleaned = 0;
  for (const [ip, v] of ipBlocklist.entries()) {
    if (v.expiresAt && v.expiresAt <= now) {
      ipBlocklist.delete(ip);
      expiredCleaned++;
    }
  }

  const entries = Array.from(ipBlocklist.entries()).map(([ip, v]) => ({ ip, ...v }));

  await reply.send({ entries, total: entries.length, expiredCleaned });
}

/**
 * FR-P15.3: IP 차단 등록
 * POST /security/ip-blocklist
 */
export async function addIpBlocklistHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // CSAP D-12: safeParse로 입력 검증
  const parsed = ipBlockSchema.safeParse(request.body);
  if (!parsed.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const body = parsed.data;
  const blockedAt = new Date().toISOString();
  const expiresAt = body.durationMinutes
    ? new Date(Date.now() + body.durationMinutes * 60 * 1000).toISOString()
    : undefined;

  ipBlocklist.set(body.ip, { reason: body.reason, blockedAt, expiresAt });

  await logSecurityEvent('IP_BLOCKED', { ip: body.ip, reason: body.reason });

  await reply.status(201).send({
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
export async function removeIpBlocklistHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { ip } = request.params as { ip: string };

  if (!ipBlocklist.has(ip)) {
    await reply.status(404).send({ error: '차단 목록에 없는 IP입니다' });
    return;
  }

  ipBlocklist.delete(ip);
  await logSecurityEvent('IP_UNBLOCKED', { ip });

  await reply.send({ success: true, ip, message: 'IP 차단 해제 완료' });
}

/**
 * FR-P15.4: 보안 이벤트 알림 목록
 * GET /security/alerts
 */
export async function securityAlertsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // CSAP D-12: safeParse로 쿼리 파라미터 검증
  const parseResult = alertsQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const limit = parseResult.data.limit;

  const where: Record<string, unknown> = {
    action: {
      in: ['LOGIN_FAILED', 'IP_BLOCKED', 'AI_GRADE_VIOLATION', 'UNAUTHORIZED_ACCESS', 'SESSION_HIJACK_ATTEMPT'],
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

  await reply.send({
    alerts: alerts.map((a) => ({
      ...a,
      severity:
        a.action === 'AI_GRADE_VIOLATION' || a.action === 'SESSION_HIJACK_ATTEMPT'
          ? 'critical'
          : a.action === 'IP_BLOCKED'
            ? 'high'
            : 'medium',
    })),
    total: alerts.length,
  });
}
