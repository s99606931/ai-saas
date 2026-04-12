// AI 에이전트 마켓플레이스/실행/감사 핸들러 — MTU-N531~N535
// Design Ref: SVC-AI-ADV-R2 DESIGN §5, SVC-AI-ADV-R5 DESIGN
// Plan SC: FR-AI-ECO.1~FR-AI-ECO.5
// CSAP: D-08 인증, D-12 입력 검증, D-06 감사 로그
// N2SF: O등급 데이터만 처리

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAiEvent } from '../lib/audit.js';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import type { DataGrade } from '@public-saas/types';

// ── 1. POST /ai/agents/marketplace/register ───────────────────────────────
const registerSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  agentName: z.string().min(1).max(100),
  description: z.string().max(2000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  capabilities: z.array(z.string()).min(1).max(20),
  manifest: z.object({
    runtime: z.enum(['node', 'python', 'wasm']),
    entrypoint: z.string().max(200),
    permissions: z.array(z.string()).max(20).optional(),
  }),
});

type RegisterBody = z.infer<typeof registerSchema>;

export async function agentMarketplaceRegisterHandler(
  request: FastifyRequest<{ Body: RegisterBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = registerSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'agent-marketplace', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade: body.grade, blocked: true, endpoint: 'agents/marketplace/register' });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }

  const agentId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  await logAiEvent('AGENT_REGISTERED', actor, agentId, body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', {
      agentName: body.agentName,
      version: body.version,
      capabilities: body.capabilities,
      runtime: body.manifest.runtime,
    });

  await reply.status(201).send({
    success: true,
    data: {
      agentId,
      agentName: body.agentName,
      version: body.version,
      status: 'registered',
      registeredAt: new Date().toISOString(),
    },
  });
}

// ── 2. GET /ai/agents/marketplace/search ──────────────────────────────────
const searchSchema = z.object({
  q: z.string().max(200).optional(),
  capability: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

type SearchQuery = z.infer<typeof searchSchema>;

export async function agentMarketplaceSearchHandler(
  request: FastifyRequest<{ Querystring: SearchQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const query = searchSchema.parse(request.query);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // 인메모리 카탈로그 (실제 구현 시 prisma.aiAgent 모델 사용)
  const catalog = [
    { agentId: 'agent_civic_classifier', name: '민원분류기', version: '1.0.0', capabilities: ['classify', 'route'] },
    { agentId: 'agent_doc_summarizer', name: '문서요약기', version: '1.2.0', capabilities: ['summarize', 'extract'] },
    { agentId: 'agent_law_interpreter', name: '법령해석기', version: '0.9.0', capabilities: ['legal', 'qa'] },
  ];

  const filtered = catalog.filter((a) => {
    if (query.q && !a.name.includes(query.q)) return false;
    if (query.capability && !a.capabilities.includes(query.capability)) return false;
    return true;
  });

  const items = filtered.slice(query.offset, query.offset + query.limit);

  await logAiEvent('AGENT_MARKETPLACE_SEARCH', actor, 'marketplace', 'system', request.ip,
    request.headers['user-agent'] ?? 'unknown', { q: query.q, capability: query.capability, count: items.length });

  await reply.send({ success: true, data: { items, total: filtered.length, limit: query.limit, offset: query.offset } });
}

// ── 3. POST /ai/agents/execute ────────────────────────────────────────────
const executeSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  agentId: z.string().min(1).max(200),
  input: z.string().min(1).max(8000),
  mode: z.enum(['plan-execute', 'react']).default('plan-execute'),
  maxSteps: z.number().int().min(1).max(20).default(10),
});

type ExecuteBody = z.infer<typeof executeSchema>;

export async function agentExecuteHandler(
  request: FastifyRequest<{ Body: ExecuteBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = executeSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, body.agentId, body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade: body.grade, blocked: true, endpoint: 'agents/execute' });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }

  const startTime = Date.now();
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // 실제 실행 위임은 advancedAgentHandler/Plan-Execute 모듈로 가능
  const result = {
    executionId,
    agentId: body.agentId,
    mode: body.mode,
    status: 'completed' as const,
    steps: [],
    answer: `[${body.agentId}] 처리가 완료되었습니다.`,
    durationMs: Date.now() - startTime,
  };

  await logAiEvent('AGENT_EXECUTE', actor, body.agentId, body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', {
      executionId,
      mode: body.mode,
      maxSteps: body.maxSteps,
      durationMs: result.durationMs,
    });

  await reply.send({ success: true, data: result });
}

// ── 4. GET /ai/agents/:id/audit-trail ─────────────────────────────────────
const auditTrailParamsSchema = z.object({ id: z.string().min(1).max(200) });
const auditTrailQuerySchema = z.object({
  tenantId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

type AuditTrailParams = z.infer<typeof auditTrailParamsSchema>;
type AuditTrailQuery = z.infer<typeof auditTrailQuerySchema>;

export async function agentAuditTrailHandler(
  request: FastifyRequest<{ Params: AuditTrailParams; Querystring: AuditTrailQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const params = auditTrailParamsSchema.parse(request.params);
  const query = auditTrailQuerySchema.parse(request.query);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // 실제 구현에서는 audit DB 조회 (CSAP D-06 1년 보존)
  const trail: Array<{ timestamp: string; action: string; actor: string; details: Record<string, unknown> }> = [];

  await logAiEvent('AGENT_AUDIT_TRAIL_QUERY', actor, params.id, query.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', { agentId: params.id, limit: query.limit });

  await reply.send({ success: true, data: { agentId: params.id, trail, total: trail.length } });
}

// ── 5. POST /ai/agents/:id/rollback ───────────────────────────────────────
const rollbackParamsSchema = z.object({ id: z.string().min(1).max(200) });
const rollbackBodySchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  targetVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  reason: z.string().min(1).max(500),
});

type RollbackParams = z.infer<typeof rollbackParamsSchema>;
type RollbackBody = z.infer<typeof rollbackBodySchema>;

export async function agentRollbackHandler(
  request: FastifyRequest<{ Params: RollbackParams; Body: RollbackBody }>,
  reply: FastifyReply,
): Promise<void> {
  const params = rollbackParamsSchema.parse(request.params);
  const body = rollbackBodySchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }

  await logAiEvent('AGENT_ROLLBACK', actor, params.id, body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', {
      agentId: params.id,
      targetVersion: body.targetVersion,
      reason: body.reason.slice(0, 200),
    });

  await reply.send({
    success: true,
    data: {
      agentId: params.id,
      previousVersion: 'unknown',
      currentVersion: body.targetVersion,
      rolledBackAt: new Date().toISOString(),
    },
  });
}
