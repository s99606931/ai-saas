// ESG/거버넌스 AI 핸들러 — MTU-N541~N544
// Design Ref: SVC-ESG-GOV DESIGN §1~§4
// Plan SC: FR-ESG-GOV.1~FR-ESG-GOV.4
// CSAP: D-08 인증, D-12 입력 검증, D-06 감사 로그

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
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'governance', tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade, blocked: true, endpoint });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return false;
    }
    throw error;
  }
}

// ── 1. POST /ai/esg/carbon/track ──────────────────────────────────────────
const carbonTrackSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  scope: z.enum(['scope1', 'scope2', 'scope3', 'all']).default('all'),
  source: z.enum(['compute', 'travel', 'electricity', 'all']).default('all'),
});

type CarbonTrackBody = z.infer<typeof carbonTrackSchema>;

export async function carbonTrackHandler(
  request: FastifyRequest<{ Body: CarbonTrackBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = carbonTrackSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  if (!(await checkGrade(body.grade as DataGrade, actor, body.tenantId, 'esg/carbon/track', request, reply))) return;

  const result = {
    period: body.period,
    scope: body.scope,
    source: body.source,
    emissions: {
      scope1: 12.5,
      scope2: 38.2,
      scope3: 87.4,
      totalKgCO2e: 138.1,
    },
    breakdown: [
      { source: 'compute', kgCO2e: 25.3 },
      { source: 'electricity', kgCO2e: 38.2 },
      { source: 'travel', kgCO2e: 74.6 },
    ],
    targetCompliance: 'on_track' as const,
  };

  await logAiEvent('ESG_CARBON_TRACK', actor, 'governance', body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', { scope: body.scope, source: body.source, totalKgCO2e: result.emissions.totalKgCO2e });

  await reply.send({ success: true, data: result });
}

// ── 2. GET /ai/esg/report/generate ────────────────────────────────────────
const esgReportSchema = z.object({
  tenantId: z.string().uuid(),
  fiscalYear: z.coerce.number().int().min(2020).max(2050),
  framework: z.enum(['GRI', 'SASB', 'TCFD', 'K-ESG']).default('K-ESG'),
});

type EsgReportQuery = z.infer<typeof esgReportSchema>;

export async function esgReportGenerateHandler(
  request: FastifyRequest<{ Querystring: EsgReportQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const query = esgReportSchema.parse(request.query);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  const report = {
    tenantId: query.tenantId,
    fiscalYear: query.fiscalYear,
    framework: query.framework,
    sections: {
      environmental: { score: 78, items: ['탄소배출', '에너지효율', '폐기물관리'] },
      social: { score: 82, items: ['다양성', '지역사회', '근로조건'] },
      governance: { score: 88, items: ['이사회구성', '감사기능', '윤리경영'] },
    },
    overallScore: 82.7,
    generatedAt: new Date().toISOString(),
  };

  await logAiEvent('ESG_REPORT_GENERATE', actor, 'governance', query.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', { fiscalYear: query.fiscalYear, framework: query.framework });

  await reply.send({ success: true, data: report });
}

// ── 3. POST /ai/governance/impact/assess ──────────────────────────────────
const impactAssessSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  aiSystemName: z.string().min(1).max(200),
  purpose: z.string().min(1).max(2000),
  dataTypes: z.array(z.string()).min(1).max(20),
  affectedGroups: z.array(z.string()).min(1).max(20),
  riskFactors: z.array(z.enum(['bias', 'privacy', 'security', 'fairness', 'transparency', 'accountability'])),
});

type ImpactAssessBody = z.infer<typeof impactAssessSchema>;

export async function aiImpactAssessHandler(
  request: FastifyRequest<{ Body: ImpactAssessBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = impactAssessSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  if (!(await checkGrade(body.grade as DataGrade, actor, body.tenantId, 'governance/impact/assess', request, reply))) return;

  const riskScore = body.riskFactors.length * 1.6;
  const assessment = {
    aiSystemName: body.aiSystemName,
    purpose: body.purpose,
    dataTypes: body.dataTypes,
    affectedGroups: body.affectedGroups,
    riskFactors: body.riskFactors,
    riskScore,
    riskLevel: riskScore < 4 ? 'low' : riskScore < 7 ? 'medium' : 'high',
    mitigations: [
      'PII 마스킹 필수',
      '편향성 모니터링',
      '결정 설명가능성 확보',
      '인간 검토 프로세스 도입',
    ],
    assessedAt: new Date().toISOString(),
  };

  await logAiEvent('AI_IMPACT_ASSESS', actor, body.aiSystemName, body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', {
      aiSystemName: body.aiSystemName,
      riskScore,
      riskLevel: assessment.riskLevel,
      factorCount: body.riskFactors.length,
    });

  await reply.send({ success: true, data: assessment });
}

// ── 4. GET /ai/governance/transparency ────────────────────────────────────
const transparencyQuerySchema = z.object({
  tenantId: z.string().uuid(),
  period: z.enum(['monthly', 'quarterly', 'yearly']).default('quarterly'),
});

type TransparencyQuery = z.infer<typeof transparencyQuerySchema>;

export async function governanceTransparencyHandler(
  request: FastifyRequest<{ Querystring: TransparencyQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const query = transparencyQuerySchema.parse(request.query);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  const report = {
    tenantId: query.tenantId,
    period: query.period,
    aiSystemsInUse: 7,
    decisionsAutomated: 12453,
    humanReviewTriggered: 287,
    appealsReceived: 3,
    biasIncidents: 0,
    dataRequests: 14,
    lastAuditDate: '2026-03-15',
    publishedAt: new Date().toISOString(),
  };

  await logAiEvent('GOVERNANCE_TRANSPARENCY', actor, 'governance', query.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', { period: query.period });

  await reply.send({ success: true, data: report });
}
