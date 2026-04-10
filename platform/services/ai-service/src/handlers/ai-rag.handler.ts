// RAG 핸들러 — FR-AI26.1
// Design Ref: SVC-AI-2026 DESIGN §1
// POST /ai/rag/ingest — 문서 수집 + 청킹 + 임베딩 + 저장
// POST /ai/rag/query — 질문 → RAG 파이프라인 → 답변 + 출처

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAiEvent } from '../lib/audit.js';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import type { DataGrade } from '@public-saas/types';
import { maskPII } from '../lib/pii-masking.js';
import { chunkText } from '../lib/chunker.js';
import { storeChunks, getKnowledgeStats } from '../lib/vector-store.js';
import { runRAG, generateEmbedding } from '../lib/rag-engine.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma 모델 미생성 상태 (SVC-AI-2026 스키마 추가 시 제거)
import { prisma } from '../lib/prisma.js';

const db = prisma as unknown as Record<string, any>;

// ── Ingest ──────────────────────────────────────────────────────────────────

const ingestSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(500_000), // 최대 50만자
  sourceUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
  embedModelId: z.string().optional(),
});

type IngestBody = z.infer<typeof ingestSchema>;

export async function ragIngestHandler(
  request: FastifyRequest<{ Body: IngestBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = ingestSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: C/S등급 차단
  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'rag', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade: body.grade, blocked: true, endpoint: 'rag/ingest' });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }

  try {
    // 1. 문서 레코드 생성 (upsert: title+tenantId 기준)
    let document: Record<string, unknown>;
    const existing = await db['aiKnowledgeDocument']?.findFirst({
      where: { tenantId: body.tenantId, title: body.title },
    }).catch(() => null);

    if (existing) {
      document = await db['aiKnowledgeDocument'].update({
        where: { id: existing.id as string },
        data: { isActive: true, sourceUrl: body.sourceUrl ?? null, updatedAt: new Date() },
      });
    } else {
      document = await db['aiKnowledgeDocument'].create({
        data: {
          tenantId: body.tenantId,
          title: maskPII(body.title),
          sourceUrl: body.sourceUrl ?? null,
          isActive: true,
          metadata: body.metadata ?? {},
        },
      });
    }

    const documentId = document['id'] as string;

    // 2. 텍스트 청킹
    const chunks = chunkText(body.content, 512, 50);

    // 3. 임베딩 생성 (배치)
    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (chunk) => {
        const embedding = await generateEmbedding(chunk.content, body.embedModelId);
        return { ...chunk, embedding };
      }),
    );

    // 4. 벡터 저장소에 저장
    await storeChunks(body.tenantId, documentId, chunksWithEmbeddings);

    // 5. 통계 조회
    const stats = await getKnowledgeStats(body.tenantId);

    await logAiEvent('RAG_INGEST', actor, 'rag', body.tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { documentId, chunkCount: chunks.length, title: body.title });

    await reply.status(200).send({
      success: true,
      data: {
        documentId,
        chunkCount: chunks.length,
        stats,
      },
    });
  } catch (err) {
    request.log.error(err, 'RAG ingest 실패');
    await reply.status(500).send({
      success: false,
      error: { code: 'RAG_INGEST_FAILED', message: 'RAG 문서 수집 중 오류가 발생했습니다.' },
    });
  }
}

// ── Query ──────────────────────────────────────────────────────────────────

const querySchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  question: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(20).optional().default(5),
  minScore: z.number().min(0).max(1).optional().default(0.25),
  embedModelId: z.string().optional(),
  chatModelId: z.string().optional(),
});

type QueryBody = z.infer<typeof querySchema>;

export async function ragQueryHandler(
  request: FastifyRequest<{ Body: QueryBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = querySchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: C/S등급 차단
  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'rag', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade: body.grade, blocked: true, endpoint: 'rag/query' });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }

  try {
    // 1. 질문 임베딩 생성
    const queryEmbedding = await generateEmbedding(body.question, body.embedModelId);

    // 2. RAG 파이프라인 실행
    let chatModelConfig: { provider: string; endpoint: string; name: string } | undefined;
    if (body.chatModelId) {
      const model = await prisma.aiModel.findUnique({ where: { id: body.chatModelId } });
      if (model?.isActive) {
        chatModelConfig = { provider: model.provider, endpoint: model.endpoint, name: model.name };
      }
    }

    const ragResponse = await runRAG(
      body.tenantId,
      body.question,
      queryEmbedding,
      { topK: body.topK, minScore: body.minScore },
      chatModelConfig,
    );

    await logAiEvent('RAG_QUERY', actor, 'rag', body.tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown', {
        question: maskPII(body.question).slice(0, 100),
        contextChunks: ragResponse.contextChunks,
        tokensUsed: ragResponse.tokensUsed,
      });

    await reply.status(200).send({
      success: true,
      data: ragResponse,
    });
  } catch (err) {
    request.log.error(err, 'RAG query 실패');
    await reply.status(502).send({
      success: false,
      error: { code: 'RAG_QUERY_FAILED', message: 'RAG 질의 처리 중 오류가 발생했습니다.' },
    });
  }
}
