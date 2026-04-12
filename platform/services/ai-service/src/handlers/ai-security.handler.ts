// 보안 AI 핸들러 — MTU-N545~N547
// Design Ref: SVC-AI-SECURITY DESIGN §1~§3
// Plan SC: FR-AI-SEC.1~FR-AI-SEC.3
// CSAP: D-08 인증, D-12 입력 검증, D-06 감사 로그, D-13 침해사고 대응

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAiEvent } from '../lib/audit.js';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import type { DataGrade } from '@public-saas/types';

async function checkGrade(
  grade: DataGrade,
  actor: string,
  tenantId: string,
  endpoint: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    validateDataGrade(grade);
    return true;
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'security', tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade, blocked: true, endpoint });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return false;
    }
    throw error;
  }
}

// ── 1. POST /ai/security/anomaly/detect ───────────────────────────────────
const anomalyDetectSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  signalType: z.enum(['login', 'api_call', 'file_access', 'network']),
  events: z.array(z.object({
    timestamp: z.string().datetime(),
    actor: z.string().max(200),
    action: z.string().max(200),
    metadata: z.record(z.unknown()).optional(),
  })).min(1).max(1000),
  sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
});

type AnomalyDetectBody = z.infer<typeof anomalyDetectSchema>;

export async function anomalyDetectHandler(
  request: FastifyRequest<{ Body: AnomalyDetectBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = anomalyDetectSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  if (!(await checkGrade(body.grade as DataGrade, actor, body.tenantId, 'security/anomaly/detect', request, reply))) return;

  // 단순 휴리스틱: 동일 actor의 빈번한 액션 = 이상치
  const counts = new Map<string, number>();
  for (const ev of body.events) {
    counts.set(ev.actor, (counts.get(ev.actor) ?? 0) + 1);
  }
  const threshold = body.sensitivity === 'high' ? 5 : body.sensitivity === 'medium' ? 10 : 20;
  const anomalies = Array.from(counts.entries())
    .filter(([, count]) => count >= threshold)
    .map(([actorId, count]) => ({ actorId, count, severity: count >= threshold * 2 ? 'high' : 'medium' }));

  await logAiEvent('SECURITY_ANOMALY_DETECT', actor, 'security', body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', {
      signalType: body.signalType,
      eventCount: body.events.length,
      anomalyCount: anomalies.length,
      sensitivity: body.sensitivity,
    });

  await reply.send({
    success: true,
    data: { signalType: body.signalType, eventCount: body.events.length, anomalies, threshold },
  });
}

// ── 2. POST /ai/security/dlp/scan ─────────────────────────────────────────
const dlpScanSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  content: z.string().min(1).max(500_000),
  rules: z.array(z.enum(['ssn', 'credit_card', 'phone', 'email', 'rrn', 'passport'])).default(['rrn', 'phone', 'email']),
});

type DlpScanBody = z.infer<typeof dlpScanSchema>;

export async function dlpScanHandler(
  request: FastifyRequest<{ Body: DlpScanBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = dlpScanSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  if (!(await checkGrade(body.grade as DataGrade, actor, body.tenantId, 'security/dlp/scan', request, reply))) return;

  const patterns: Record<string, RegExp> = {
    rrn: /\d{6}-\d{7}/g,
    phone: /01[0-9]-\d{3,4}-\d{4}/g,
    email: /[\w.-]+@[\w.-]+\.\w+/g,
    ssn: /\d{3}-\d{2}-\d{4}/g,
    credit_card: /\d{4}-\d{4}-\d{4}-\d{4}/g,
    passport: /[A-Z]\d{8}/g,
  };

  const findings: Array<{ rule: string; count: number; samples: string[] }> = [];
  for (const rule of body.rules) {
    const regex = patterns[rule];
    if (!regex) continue;
    const matches = body.content.match(regex) ?? [];
    if (matches.length > 0) {
      findings.push({
        rule,
        count: matches.length,
        samples: matches.slice(0, 3).map((m) => m.replace(/./g, '*')),
      });
    }
  }

  await logAiEvent('SECURITY_DLP_SCAN', actor, 'security', body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', {
      contentLength: body.content.length,
      rules: body.rules,
      findingCount: findings.length,
    });

  await reply.send({
    success: true,
    data: { findings, totalFindings: findings.reduce((s, f) => s + f.count, 0), rulesApplied: body.rules },
  });
}

// ── 3. GET /ai/security/threat/feed ───────────────────────────────────────
const threatFeedSchema = z.object({
  tenantId: z.string().uuid(),
  source: z.enum(['krcert', 'misp', 'otx', 'all']).default('all'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

type ThreatFeedQuery = z.infer<typeof threatFeedSchema>;

export async function threatFeedHandler(
  request: FastifyRequest<{ Querystring: ThreatFeedQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const query = threatFeedSchema.parse(request.query);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // 인메모리 샘플 (실제 구현 시 외부 피드 캐시 조회 — N2SF O등급)
  const feed = [
    { id: 'thr_001', source: 'krcert', severity: 'high', cve: 'CVE-2026-1234', summary: 'OpenSSL RCE 취약점' },
    { id: 'thr_002', source: 'misp', severity: 'medium', cve: 'CVE-2026-2345', summary: 'k8s API 권한 우회' },
    { id: 'thr_003', source: 'otx', severity: 'critical', cve: 'CVE-2026-3456', summary: 'Linux 커널 LPE' },
  ];

  const filtered = feed.filter((t) => {
    if (query.source !== 'all' && t.source !== query.source) return false;
    if (query.severity && t.severity !== query.severity) return false;
    return true;
  });

  await logAiEvent('SECURITY_THREAT_FEED', actor, 'security', query.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', { source: query.source, severity: query.severity, count: filtered.length });

  await reply.send({
    success: true,
    data: { items: filtered.slice(0, query.limit), total: filtered.length, source: query.source },
  });
}
