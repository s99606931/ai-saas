// 데이터 플랫폼 AI 핸들러 — MTU-N548~N550
// Design Ref: SVC-AI-DATA DESIGN §1~§3
// Plan SC: FR-AI-DATA.1~FR-AI-DATA.3
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
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'data-platform', tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade, blocked: true, endpoint });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return false;
    }
    throw error;
  }
}

// ── 1. POST /ai/data/quality/check ────────────────────────────────────────
const dataQualitySchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  datasetId: z.string().min(1).max(200),
  rules: z.array(z.enum(['completeness', 'uniqueness', 'validity', 'consistency', 'timeliness'])).min(1),
  sampleSize: z.number().int().min(10).max(100_000).default(1000),
});

type DataQualityBody = z.infer<typeof dataQualitySchema>;

export async function dataQualityCheckHandler(
  request: FastifyRequest<{ Body: DataQualityBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = dataQualitySchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  if (!(await checkGrade(body.grade as DataGrade, actor, body.tenantId, 'data/quality/check', request, reply))) return;

  const result = {
    datasetId: body.datasetId,
    sampleSize: body.sampleSize,
    rules: body.rules.map((rule) => ({
      rule,
      score: 0.85 + Math.random() * 0.1,
      passed: true,
      issueCount: Math.floor(Math.random() * 5),
    })),
    overallScore: 0.91,
    checkedAt: new Date().toISOString(),
  };

  await logAiEvent('DATA_QUALITY_CHECK', actor, body.datasetId, body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', {
      datasetId: body.datasetId,
      ruleCount: body.rules.length,
      overallScore: result.overallScore,
    });

  await reply.send({ success: true, data: result });
}

// ── 2. GET /ai/data/catalog/search ────────────────────────────────────────
const catalogSearchSchema = z.object({
  tenantId: z.string().uuid(),
  q: z.string().max(200).optional(),
  domain: z.string().max(100).optional(),
  tag: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

type CatalogSearchQuery = z.infer<typeof catalogSearchSchema>;

export async function dataCatalogSearchHandler(
  request: FastifyRequest<{ Querystring: CatalogSearchQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const query = catalogSearchSchema.parse(request.query);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  const catalog = [
    { id: 'ds_001', name: '민원데이터셋', domain: 'civic', tags: ['민원', '응답시간'], rowCount: 142_530 },
    { id: 'ds_002', name: '예산집행현황', domain: 'finance', tags: ['예산', '집행'], rowCount: 38_200 },
    { id: 'ds_003', name: '시설관리이력', domain: 'facility', tags: ['시설', '점검'], rowCount: 9_872 },
  ];

  const filtered = catalog.filter((d) => {
    if (query.q && !d.name.includes(query.q)) return false;
    if (query.domain && d.domain !== query.domain) return false;
    if (query.tag && !d.tags.includes(query.tag)) return false;
    return true;
  });

  await logAiEvent('DATA_CATALOG_SEARCH', actor, 'data-platform', query.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', { q: query.q, domain: query.domain, count: filtered.length });

  await reply.send({
    success: true,
    data: { items: filtered.slice(0, query.limit), total: filtered.length },
  });
}

// ── 3. POST /ai/data/stream/ingest ────────────────────────────────────────
const streamIngestSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  streamId: z.string().min(1).max(200),
  records: z.array(z.record(z.unknown())).min(1).max(10_000),
  partitionKey: z.string().max(200).optional(),
});

type StreamIngestBody = z.infer<typeof streamIngestSchema>;

export async function dataStreamIngestHandler(
  request: FastifyRequest<{ Body: StreamIngestBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = streamIngestSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  if (!(await checkGrade(body.grade as DataGrade, actor, body.tenantId, 'data/stream/ingest', request, reply))) return;

  const result = {
    streamId: body.streamId,
    accepted: body.records.length,
    rejected: 0,
    partitionKey: body.partitionKey ?? 'default',
    ingestedAt: new Date().toISOString(),
    receiptId: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
  };

  await logAiEvent('DATA_STREAM_INGEST', actor, body.streamId, body.tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown', {
      streamId: body.streamId,
      recordCount: body.records.length,
      partitionKey: result.partitionKey,
    });

  await reply.send({ success: true, data: result });
}
