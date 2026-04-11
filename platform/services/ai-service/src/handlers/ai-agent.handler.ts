// ReAct / Plan-Execute / Orchestrator 에이전트 핸들러 — FR-AI26.2, FR-ADV2.1~FR-ADV2.6
// Design Ref: SVC-AI-2026 DESIGN §2, SVC-AI-ADV-R2 DESIGN §1~§5
// POST /ai/agent — ReAct / Plan-Execute / Orchestrator 모드 에이전트 실행

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
import { runPlanExecute } from '../lib/agent-planner.js';
import { runOrchestrator } from '../lib/agent-orchestrator.js';
import type { SubAgentRole } from '../lib/agent-orchestrator.js';
import { getOrCreateSession, addToMemory, memoryToMessages, loadLongTermMemory } from '../lib/agent-memory.js';
import { getOrCreateRegistry } from '../lib/tool-registry.js';

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

// ── Advanced Agent Handler (Plan-Execute / Orchestrator) ───────────────────
// Design Ref: SVC-AI-ADV-R2 DESIGN §5
// Plan SC: FR-ADV2.6

const advancedAgentSchema = z.object({
  tenantId: z.string().uuid(),
  grade: z.enum(['O']),
  query: z.string().min(1).max(4000),
  maxIterations: z.number().int().min(1).max(10).optional().default(10),
  tools: z.array(z.string()).optional(),
  modelId: z.string().optional(),
  // Advanced Agent 전용 옵션
  mode: z.enum(['react', 'plan-execute', 'orchestrate']).optional().default('react'),
  sessionId: z.string().min(1).max(100).optional(),
  enableMemory: z.boolean().optional().default(false),
  subAgents: z.array(z.enum(['researcher', 'analyst', 'writer', 'reviewer'])).optional(),
});

type AdvancedAgentBody = z.infer<typeof advancedAgentSchema>;

/**
 * Advanced Agent 핸들러: ReAct / Plan-Execute / Orchestrator 모드
 * Plan SC: FR-ADV2.6
 *
 * - mode='react': 기존 ReAct 패턴 (기본)
 * - mode='plan-execute': 계획 수립 -> 단계별 실행
 * - mode='orchestrate': 서브에이전트 위임 실행
 *
 * enableMemory=true 시 세션 메모리 활성화
 */
export async function advancedAgentHandler(
  request: FastifyRequest<{ Body: AdvancedAgentBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = advancedAgentSchema.parse(request.body);
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: C/S등급 차단
  try {
    validateDataGrade(body.grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, 'agent-advanced', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade: body.grade, blocked: true, endpoint: 'agent/advanced' });
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

    // 메모리 컨텍스트 구성
    let memoryContext: string | undefined;
    if (body.enableMemory && body.sessionId) {
      const session = getOrCreateSession(body.tenantId, body.sessionId);
      const longTerm = await loadLongTermMemory(body.tenantId);
      const memMessages = memoryToMessages(session);

      // 메모리 컨텍스트 문자열 구성
      const parts: string[] = [];
      if (longTerm) parts.push(longTerm);
      if (memMessages.length > 0) {
        parts.push(
          memMessages
            .map((m) => `${m.role === 'user' ? '사용자' : 'AI'}: ${typeof m.content === 'string' ? m.content : ''}`)
            .join('\n'),
        );
      }
      memoryContext = parts.length > 0 ? parts.join('\n---\n') : undefined;

      // 현재 쿼리를 세션 메모리에 추가
      await addToMemory(session, 'user', body.query);
    }

    const startTime = Date.now();

    // 모드별 분기 실행
    if (body.mode === 'plan-execute') {
      // ── Plan-Execute 모드 ────────────────────────────────────────────────
      const registry = getOrCreateRegistry(body.tenantId, {
        ragSearch: async (query: string, tenantId: string) => {
          const embedding = await generateEmbedding(query);
          const rag = await runRAG(tenantId, query, embedding, { topK: 3, minScore: 0.25 });
          return rag.answer;
        },
      });

      const tools = registry.getTools(body.tools ?? undefined);
      const executors = registry.getExecutors(body.tools ?? undefined);

      const result = await runPlanExecute(
        body.query,
        tools,
        executors,
        { additionalContext: memoryContext },
        modelConfig,
      );

      const durationMs = Date.now() - startTime;

      // 메모리에 응답 저장
      if (body.enableMemory && body.sessionId) {
        const session = getOrCreateSession(body.tenantId, body.sessionId);
        await addToMemory(session, 'assistant', result.answer);
      }

      await logAiEvent('AGENT_PLAN_EXECUTE', actor, 'agent-advanced', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', {
          query: maskPII(body.query).slice(0, 100),
          mode: 'plan-execute',
          stepsPlanned: result.plan.steps.length,
          stepsCompleted: result.steps.filter((s) => s.status === 'completed').length,
          replanned: result.replanned,
          tokensUsed: result.tokensUsed,
          durationMs,
        });

      await reply.status(200).send({
        success: true,
        data: {
          mode: 'plan-execute',
          answer: result.answer,
          plan: result.plan,
          steps: result.steps,
          replanned: result.replanned,
          tokensUsed: result.tokensUsed,
          model: result.model,
          durationMs,
        },
      });
    } else if (body.mode === 'orchestrate') {
      // ── Orchestrator 모드 ────────────────────────────────────────────────
      const result = await runOrchestrator(
        body.query,
        body.subAgents as SubAgentRole[] | undefined,
        { additionalContext: memoryContext },
        modelConfig,
      );

      const durationMs = Date.now() - startTime;

      // 메모리에 응답 저장
      if (body.enableMemory && body.sessionId) {
        const session = getOrCreateSession(body.tenantId, body.sessionId);
        await addToMemory(session, 'assistant', result.answer);
      }

      await logAiEvent('AGENT_ORCHESTRATE', actor, 'agent-advanced', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', {
          query: maskPII(body.query).slice(0, 100),
          mode: 'orchestrate',
          subAgents: result.subAgentResults.map((r) => r.role),
          tokensUsed: result.totalTokensUsed,
          durationMs,
        });

      await reply.status(200).send({
        success: true,
        data: {
          mode: 'orchestrate',
          answer: result.answer,
          subAgentResults: result.subAgentResults,
          tokensUsed: result.totalTokensUsed,
          model: result.model,
          durationMs,
        },
      });
    } else {
      // ── ReAct 모드 (기존 동작) ──────────────────────────────────────────
      const llmConfig = modelConfig ? buildLLMConfig(modelConfig) : getLLMConfig();
      const provider = await createLLMProvider(llmConfig);

      const allowedTools = body.tools
        ? TOOL_DEFINITIONS.filter((t) => body.tools!.includes(t.name))
        : TOOL_DEFINITIONS;

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
              { role: 'system', content: '민원 분류 전문가입니다. JSON 형식으로만 응답하세요.' },
              { role: 'user', content: `다음 민원을 분류하세요: ${text.slice(0, 2000)}` },
            ],
            { maxTokens: 256, temperature: 0.1 },
          );
          return resp.text;
        },
      });

      const result = await runAgent(
        body.query,
        allowedTools,
        executors,
        {
          maxIterations: body.maxIterations,
          systemPromptSuffix: memoryContext ? `\n[이전 대화 맥락]\n${memoryContext}` : undefined,
        },
        modelConfig,
      );

      const durationMs = Date.now() - startTime;

      // 메모리에 응답 저장
      if (body.enableMemory && body.sessionId) {
        const session = getOrCreateSession(body.tenantId, body.sessionId);
        await addToMemory(session, 'assistant', result.answer);
      }

      await logAiEvent('AGENT_REACT', actor, 'agent-advanced', body.tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', {
          query: maskPII(body.query).slice(0, 100),
          mode: 'react',
          iterations: result.iterations,
          tokensUsed: result.tokensUsed,
          timedOut: result.timedOut,
          durationMs,
        });

      await reply.status(200).send({
        success: true,
        data: {
          mode: 'react',
          answer: result.answer,
          steps: result.steps,
          iterations: result.iterations,
          tokensUsed: result.tokensUsed,
          model: result.model,
          timedOut: result.timedOut,
          durationMs,
        },
      });
    }
  } catch (err) {
    request.log.error(err, 'Advanced Agent 실행 실패');
    await reply.status(502).send({
      success: false,
      error: { code: 'AGENT_ADVANCED_FAILED', message: 'AI 에이전트 실행 중 오류가 발생했습니다.' },
    });
  }
}
