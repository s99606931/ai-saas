// Function Calling 핸들러 -- FR-ADV4.5
// Design Ref: SVC-AI-ADV-R4 DESIGN §3
// POST /ai/function-call — OpenAI 호환 Function Calling
// CSAP: D-08 접근 통제, D-12 시스템 개발 보안, N2SF N-05 O등급

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAiEvent } from '../lib/audit.js';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import type { DataGrade } from '@public-saas/types';
import { runFunctionCalling } from '../lib/function-calling.js';
import type { LLMMessage } from '../lib/llm-provider.js';
import { generateEmbedding, runRAG } from '../lib/rag-engine.js';
import { prisma } from '../lib/prisma.js';
import { getLLMConfig, buildLLMConfig, createLLMProvider } from '../lib/llm-provider.js';
import { getOrCreateRegistry } from '../lib/tool-registry.js';

// ── 스키마 ──────────────────────────────────────────────────────────────

const functionCallSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().min(1).max(8192),
  })).min(1),
  tools: z.array(z.string()).optional(), // 허용 도구 필터
  toolChoice: z.enum(['auto', 'none']).optional().default('auto'),
  maxRounds: z.number().int().min(1).max(10).optional().default(5),
  modelId: z.string().optional(),
});

type FunctionCallBody = z.infer<typeof functionCallSchema>;

/**
 * Function Calling 핸들러
 * Plan SC: FR-ADV4.5
 */
export async function functionCallHandler(
  request: FastifyRequest<{ Body: FunctionCallBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = functionCallSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: C/S등급 차단
  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'function-call', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade: body.grade, blocked: true, endpoint: 'function-call' });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }

  try {
    // 모델 설정 조회
    let modelConfig: { provider: string; endpoint: string; name: string; config?: unknown } | undefined;
    if (body.modelId) {
      const model = await prisma.aiModel.findUnique({ where: { id: body.modelId } });
      if (model?.isActive) {
        modelConfig = { provider: model.provider, endpoint: model.endpoint, name: model.name, config: model.config };
      }
    }

    // 도구 레지스트리에서 도구 조회
    const llmConfig = modelConfig ? buildLLMConfig(modelConfig) : getLLMConfig();
    const provider = await createLLMProvider(llmConfig);

    const registry = getOrCreateRegistry(body.tenantId, {
      ragSearch: async (query: string, tenantId: string) => {
        const embedding = await generateEmbedding(query);
        const rag = await runRAG(tenantId, query, embedding, { topK: 3, minScore: 0.25 });
        return rag.answer;
      },
      llmSummarize: async (text: string) => {
        const resp = await provider.chat(
          [{ role: 'user', content: `다음 텍스트를 3줄로 요약해주세요:\n\n${text.slice(0, 10000)}` }],
          { maxTokens: 512, temperature: 0.3 },
        );
        return resp.text;
      },
    });

    const tools = registry.getTools(body.tools ?? undefined);
    const executors = registry.getExecutors(body.tools ?? undefined);

    // Function Calling 실행
    const startTime = Date.now();
    const result = await runFunctionCalling(
      body.messages as LLMMessage[],
      tools,
      executors,
      {
        maxRounds: body.maxRounds,
        toolChoice: body.toolChoice,
      },
      modelConfig,
    );
    const durationMs = Date.now() - startTime;

    await logAiEvent('FUNCTION_CALL', actor, 'function-call', body.tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown', {
        toolChoice: body.toolChoice,
        toolCallCount: result.toolCalls.length,
        rounds: result.rounds,
        tokensUsed: result.tokensUsed,
        durationMs,
      });

    await reply.status(200).send({
      success: true,
      data: {
        answer: result.answer,
        toolCalls: result.toolCalls,
        rounds: result.rounds,
        tokensUsed: result.tokensUsed,
        model: result.model,
        durationMs,
      },
    });
  } catch (err) {
    request.log.error(err, 'Function Calling 실패');
    await reply.status(502).send({
      success: false,
      error: { code: 'FUNCTION_CALL_FAILED', message: 'Function Calling 실행 중 오류가 발생했습니다.' },
    });
  }
}
