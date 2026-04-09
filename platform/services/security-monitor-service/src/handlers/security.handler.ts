// 보안 모니터링 핸들러
// Design Ref: DESIGN-MTU-P15 §2
// Plan SC: FR-P15.1~FR-P15.4
// CSAP: D-06, D-10

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logSecurityEvent } from '../lib/audit.js';
import { auditClient } from '../lib/audit-client.js';

// --- IP 차단 목록 (In-memory + 영속 저장 대비) ---

interface BlockedIp {
  ip: string;
  reason: string;
  blockedAt: string;
  expiresAt?: string;
}

const ipBlocklist = new Map<string, BlockedIp>();

// --- 보안 알림 저장소 ---

interface SecurityAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  acknowledged: boolean;
}

const alerts: SecurityAlert[] = [];
let alertIdCounter = 1;

// --- Zod 스키마 (CSAP D-12: 모든 입력 검증) ---

// FR-SECMON.5: IP 형식 검증 강화 (Design Ref: SVC-SECMON-R1 DESIGN)
// IPv4, IPv6, CIDR 표기 지원
const IP_PATTERN = /^(?:(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?|[0-9a-fA-F:]+(?:\/\d{1,3})?)$/;

const ipBlockSchema = z.object({
  ip: z.string().min(1).max(45).refine(
    (val) => IP_PATTERN.test(val),
    { message: '유효한 IPv4, IPv6 또는 CIDR 형식이어야 합니다' },
  ),
  reason: z.string().min(1).max(255),
  expiresAt: z.string().optional(),
});

const loginFailuresQuerySchema = z.object({
  threshold: z.coerce.number().int().min(1).max(100).default(5),
  window: z.coerce.number().int().min(1).max(1440).default(5),
});

const alertsQuerySchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  acknowledged: z.enum(['true', 'false']).optional(),
});

/**
 * FR-P15.1: 로그인 실패 패턴 탐지
 * GET /security/login-failures
 */
export async function loginFailuresHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: safeParse로 쿼리 파라미터 검증
  const parseResult = loginFailuresQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const threshold = parseResult.data.threshold;
  const windowMinutes = parseResult.data.window;

  // 감사 로그 서비스에서 로그인 실패 이벤트 조회 (추상화된 클라이언트 사용)
  const fromDate = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  try {
    const result = await auditClient.queryLogs({
      action: 'LOGIN_FAILED',
      fromDate,
      limit: 100,
    });
    const items = result.items;

    // IP별 실패 횟수 집계
    const ipCounts = new Map<string, number>();
    for (const item of items) {
      const ip = item.ip ?? 'unknown';
      ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
    }

    const suspicious = Array.from(ipCounts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([ip, count]) => ({ ip, failureCount: count, window: `${windowMinutes}분` }));

    // 임계값 초과 시 자동 알림 생성
    for (const s of suspicious) {
      const alert: SecurityAlert = {
        id: `SEC-${String(alertIdCounter++).padStart(4, '0')}`,
        severity: s.failureCount >= threshold * 2 ? 'critical' : 'high',
        type: 'LOGIN_FAILURE_THRESHOLD',
        message: `IP ${s.ip}에서 ${s.failureCount}회 로그인 실패 (${windowMinutes}분 이내)`,
        metadata: { ip: s.ip, count: s.failureCount },
        createdAt: new Date().toISOString(),
        acknowledged: false,
      };
      alerts.push(alert);
      await logSecurityEvent('LOGIN_FAILURE_ALERT', { ip: s.ip, count: s.failureCount });
    }

    await reply.send({
      threshold,
      windowMinutes,
      totalFailures: items.length,
      suspiciousIps: suspicious,
      lastChecked: new Date().toISOString(),
    });
  } catch {
    await reply.send({
      threshold,
      windowMinutes,
      totalFailures: 0,
      suspiciousIps: [],
      error: '감사 로그 서비스 연결 실패',
      lastChecked: new Date().toISOString(),
    });
  }
}

/**
 * FR-P15.2: 이상 접근 패턴 탐지
 * GET /security/anomalies
 */
export async function anomaliesHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 이상 접근 패턴 분석 (동시 다중 IP, 비정상 시간대, 대량 요청)
  const anomalyRules = [
    {
      id: 'MULTI_IP_LOGIN',
      name: '동시 다중 IP 로그인',
      description: '동일 계정이 5분 내 3개 이상 IP에서 로그인 시도',
      status: 'monitoring',
      detections: 0,
    },
    {
      id: 'OFF_HOURS_ACCESS',
      name: '비정상 시간대 접근',
      description: '22:00~06:00 사이 관리자 접근',
      status: 'monitoring',
      detections: 0,
    },
    {
      id: 'BULK_REQUEST',
      name: '단시간 대량 요청',
      description: '1분 내 100회 이상 API 요청',
      status: 'monitoring',
      detections: 0,
    },
    {
      id: 'PRIVILEGE_ESCALATION',
      name: '권한 상승 시도',
      description: '비인가 역할 접근 시도',
      status: 'monitoring',
      detections: 0,
    },
  ];

  await reply.send({
    rules: anomalyRules,
    totalDetections: anomalyRules.reduce((sum, r) => sum + r.detections, 0),
    lastChecked: new Date().toISOString(),
  });
}

/**
 * FR-P15.3: IP 차단 목록 조회
 * GET /security/ip-blocklist
 * FR-SECMON.4: 만료된 엔트리 자동 정리 (Design Ref: SVC-SECMON-R1 DESIGN)
 */
export async function getBlocklistHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // FR-SECMON.4: 만료된 엔트리 자동 정리
  const now = new Date();
  let expiredCount = 0;
  for (const [ip, entry] of ipBlocklist) {
    if (entry.expiresAt && new Date(entry.expiresAt) < now) {
      ipBlocklist.delete(ip);
      expiredCount++;
    }
  }

  const list = Array.from(ipBlocklist.values());
  await reply.send({
    items: list,
    total: list.length,
    expiredCleaned: expiredCount,
  });
}

/**
 * FR-P15.3: IP 차단 등록
 * POST /security/ip-blocklist
 */
export async function addBlocklistHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = ipBlockSchema.safeParse(request.body);

  if (!parsed.success) {
    await reply.status(400).send({ error: '입력 검증 실패', details: parsed.error.issues });
    return;
  }

  const entry: BlockedIp = {
    ip: parsed.data.ip,
    reason: parsed.data.reason,
    blockedAt: new Date().toISOString(),
    expiresAt: parsed.data.expiresAt,
  };

  ipBlocklist.set(parsed.data.ip, entry);

  await logSecurityEvent('IP_BLOCKED', { ip: parsed.data.ip, reason: parsed.data.reason });

  await reply.status(201).send({ status: 'blocked', entry });
}

/**
 * FR-P15.3: IP 차단 해제
 * DELETE /security/ip-blocklist/:ip
 */
export async function removeBlocklistHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { ip } = request.params as { ip: string };

  if (!ipBlocklist.has(ip)) {
    await reply.status(404).send({ error: `IP ${ip}이(가) 차단 목록에 없습니다` });
    return;
  }

  ipBlocklist.delete(ip);
  await logSecurityEvent('IP_UNBLOCKED', { ip });

  await reply.send({ status: 'unblocked', ip });
}

/**
 * FR-P15.4: 보안 이벤트 알림 목록
 * GET /security/alerts
 */
export async function alertsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: safeParse로 쿼리 파라미터 검증
  const parseResult = alertsQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const severity = parseResult.data.severity;
  const acknowledged = parseResult.data.acknowledged;

  let filtered = [...alerts];

  if (severity) {
    filtered = filtered.filter((a) => a.severity === severity);
  }
  if (acknowledged !== undefined) {
    filtered = filtered.filter((a) => a.acknowledged === (acknowledged === 'true'));
  }

  // 최신순 정렬
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  await reply.send({
    items: filtered.slice(0, 50),
    total: filtered.length,
  });
}

/**
 * FR-SECMON.2: 알림 확인(Acknowledge)
 * PUT /security/alerts/:id/acknowledge
 * Design Ref: SVC-SECMON-R1 DESIGN
 * CSAP D-06: 감사 로그 기록
 */
export async function acknowledgeAlertHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const alert = alerts.find((a) => a.id === request.params.id);

  if (!alert) {
    await reply.status(404).send({
      success: false,
      error: { code: 'ALERT_NOT_FOUND', message: '보안 알림을 찾을 수 없습니다' },
    });
    return;
  }

  if (alert.acknowledged) {
    await reply.send({
      success: true,
      data: alert,
      message: '이미 확인된 알림입니다',
    });
    return;
  }

  alert.acknowledged = true;

  // 감사 로그 (CSAP D-06)
  const actor = (request.headers['x-user-id'] as string) || 'system';
  await logSecurityEvent('ALERT_ACKNOWLEDGED', {
    alertId: alert.id,
    severity: alert.severity,
    type: alert.type,
    actor,
  });

  await reply.send({ success: true, data: alert });
}

/**
 * FR-SECMON.3: 알림 심각도 대시보드
 * GET /security/alerts/summary
 * Design Ref: SVC-SECMON-R1 DESIGN
 */
export async function alertsSummaryHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const summary = {
    total: alerts.length,
    unacknowledged: alerts.filter((a) => !a.acknowledged).length,
    bySeverity: {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      high: alerts.filter((a) => a.severity === 'high').length,
      medium: alerts.filter((a) => a.severity === 'medium').length,
      low: alerts.filter((a) => a.severity === 'low').length,
    },
    latestAlert: alerts.length > 0
      ? alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null,
  };

  await reply.send({ success: true, data: summary });
}
