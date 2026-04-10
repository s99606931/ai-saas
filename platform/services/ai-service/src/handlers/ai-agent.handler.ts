// ReAct 에이전트 핸들러 — FR-AI26.2
// Design Ref: SVC-AI-2026 DESIGN §2
// POST /ai/agent — ReAct 패턴 에이전트 실행

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAiEvent } from '../lib/audit.js';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import type { DataGrade } from '@public-saas/types';
import { maskPII } from '../lib/pii-masking.js';
import { runAgent } from '../lib/ai-agent.js';
import { TOOL_DEFINITIONS, createToolExecutors } from '../lib/ai-tools.js';
import { generateEmbedding, runRAG } from '../lib/rag-engine.js';
import { prisma } from '../lib/prisma.js';
import { getLLMConfig, buildLLMConfig, createLLMProvider } from '../lib/llm-provider.js';

const agentSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  query: z.string().min(1).max(4000),
  maxIterations: z.number().int().min(1).max(10).optional().default(10),
  tools: z.array(z.string()).optional(), // 허용할 도구 이름 목록 (미지정 시 전체)
  modelId: z.string().optional(),
});

type AgentBody = z.infer<typeof agentSchema>;

export async function agentHandler(
  request: FastifyRequest<{ Body: AgentBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = agentSchema.parse(request.body);

  const actor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: C/S등급 차단
  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'agent', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade: body.grade, blocked: true, endpoint: 'agent' });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }

  try {
    // 도구 필터링 (요청된 도구만 허용)
    const allowedTools = body.tools
      ? TOOL_DEFINITIONS.filter((t) => body.tools!.includes(t.name))
      : TOOL_DEFINITIONS;

    // 모델 설정 조회
    let modelConfig: { provider: string; endpoint: string; name: string; config?: unknown } | undefined;
    if (body.modelId) {
      const model = await prisma.aiModel.findUnique({ where: { id: body.modelId } });
      if (model?.isActive) {
        modelConfig = { provider: model.provider, endpoint: model.endpoint, name: model.name, config: model.config };
      }
    }

    // LLM 인스턴스 생성 (summarize/classify용)
    const llmConfig = modelConfig
      ? buildLLMConfig(modelConfig)
      : getLLMConfig();
    const provider = await createLLMProvider(llmConfig);

    // 도구 실행기 생성 (RAG search, LLM summarize/classify 의존성 주입)
    const executors = createToolExecutors({
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
      llmClassify: async (text: string) => {
        const resp = await provider.chat(
          [
            {
              role: 'system',
              content: '민원 분류 전문가입니다. JSON 형식으로만 응답하세요.',
            },
            {
              role: 'user',
              content: `다음 민원을 분류하세요 (JSON: {category, priority, requiresHuman}): ${text.slice(0, 2000)}`,
            },
          ],
          { maxTokens: 256, temperature: 0.1 },
        );
        return resp.text;
      },
    });

    // ReAct 에이전트 실행
    const startTime = Date.now();
    const result = await runAgent(
      body.query,
      allowedTools,
      executors,
      { maxIterations: body.maxIterations },
      modelConfig,
    );
    const durationMs = Date.now() - startTime;

    await logAiEvent('AGENT_RUN', actor, 'agent', body.tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown', {
        query: maskPII(body.query).slice(0, 100),
        iterations: result.iterations,
        tokensUsed: result.tokensUsed,
        timedOut: result.timedOut,
        durationMs,
      });

    await reply.status(200).send({
      success: true,
      data: {
        answer: result.answer,
        steps: result.steps,
        iterations: result.iterations,
        tokensUsed: result.tokensUsed,
        model: result.model,
        timedOut: result.timedOut,
        durationMs,
      },
    });
  } catch (err) {
    request.log.error(err, 'Agent 실행 실패');
    await reply.status(502).send({
      success: false,
      error: { code: 'AGENT_FAILED', message: 'AI 에이전트 실행 중 오류가 발생했습니다.' },
    });
  }
}
