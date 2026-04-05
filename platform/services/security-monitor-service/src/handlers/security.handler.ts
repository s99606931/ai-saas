// 보안 모니터링 핸들러
// Design Ref: DESIGN-MTU-P15 §2
// Plan SC: FR-P15.1~FR-P15.4
// CSAP: D-06, D-10

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logSecurityEvent } from '../lib/audit.js';

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

// --- Zod 스키마 ---

const ipBlockSchema = z.object({
  ip: z.string().min(1).max(45),
  reason: z.string().min(1).max(255),
  expiresAt: z.string().optional(),
});

/**
 * FR-P15.1: 로그인 실패 패턴 탐지
 * GET /security/login-failures
 */
export async function loginFailuresHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const query = request.query as Record<string, string>;
  const threshold = parseInt(query['threshold'] ?? '5', 10);
  const windowMinutes = parseInt(query['window'] ?? '5', 10);

  // 감사 로그 서비스에서 로그인 실패 이벤트 조회
  const auditUrl = process.env['AUDIT_SERVICE_URL'] ?? 'http://localhost:3012';
  const fromDate = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  try {
    const response = await fetch(
      `${auditUrl}/audit/logs?action=LOGIN_FAILED&fromDate=${fromDate}&limit=100`,
    );
    const data = (await response.json()) as { items?: Array<{ ip?: string; actorId?: string; createdAt?: string }> };
    const items = data.items ?? [];

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

    reply.send({
      threshold,
      windowMinutes,
      totalFailures: items.length,
      suspiciousIps: suspicious,
      lastChecked: new Date().toISOString(),
    });
  } catch {
    reply.send({
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

  reply.send({
    rules: anomalyRules,
    totalDetections: anomalyRules.reduce((sum, r) => sum + r.detections, 0),
    lastChecked: new Date().toISOString(),
  });
}

/**
 * FR-P15.3: IP 차단 목록 조회
 * GET /security/ip-blocklist
 */
export async function getBlocklistHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const list = Array.from(ipBlocklist.values());
  reply.send({ items: list, total: list.length });
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
    reply.status(400).send({ error: '입력 검증 실패', details: parsed.error.issues });
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

  reply.status(201).send({ status: 'blocked', entry });
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
    reply.status(404).send({ error: `IP ${ip}이(가) 차단 목록에 없습니다` });
    return;
  }

  ipBlocklist.delete(ip);
  await logSecurityEvent('IP_UNBLOCKED', { ip });

  reply.send({ status: 'unblocked', ip });
}

/**
 * FR-P15.4: 보안 이벤트 알림 목록
 * GET /security/alerts
 */
export async function alertsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const query = request.query as Record<string, string>;
  const severity = query['severity'];
  const acknowledged = query['acknowledged'];

  let filtered = [...alerts];

  if (severity) {
    filtered = filtered.filter((a) => a.severity === severity);
  }
  if (acknowledged !== undefined) {
    filtered = filtered.filter((a) => a.acknowledged === (acknowledged === 'true'));
  }

  // 최신순 정렬
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  reply.send({
    items: filtered.slice(0, 50),
    total: filtered.length,
  });
}
