// AI 서비스 라우트
// Design Ref: DESIGN-MTU-P10, SVC-AI-R3 DESIGN, SVC-AI-2026 DESIGN
// Plan SC: FR-P10.1~FR-P10.6, FR-AI-R3.1~FR-AI-R3.4, FR-AI26.1~FR-AI26.5
// CSAP: D-08-06 Rate Limiting, D-10 네트워크 보안

import type { FastifyInstance } from 'fastify';
import {
  listModelsHandler,
  createModelHandler,
  updateModelHandler,
  chatHandler,
  usageHandler,
  costHandler,
} from './handlers/ai.handler.js';
import { aiUsageTrendHandler, modelAnalyticsHandler } from './handlers/ai-analytics.handler.js';
import { chatStreamHandler } from './handlers/ai-stream.handler.js';
import { embedHandler } from './handlers/ai-embed.handler.js';
import { providerHealthHandler, providerModelsHandler } from './handlers/ai-provider.handler.js';
import { ragIngestHandler, ragQueryHandler } from './handlers/ai-rag.handler.js';
import { agentHandler } from './handlers/ai-agent.handler.js';
import { structuredOutputHandler } from './handlers/ai-structured.handler.js';
import { documentAnalyzeHandler, documentCompareHandler } from './handlers/ai-document.handler.js';
import { workflowHandler } from './handlers/ai-workflow.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // C-03 수정 (CSAP D-08): 서비스 간 내부 인증 — API 게이트웨이 우회 차단
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  if (!internalKey && process.env['NODE_ENV'] === 'production') {
    throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수가 설정되지 않았습니다. 서비스를 시작할 수 없습니다.');
  }
  if (internalKey) {
    app.addHook('onRequest', async (request, reply) => {
      if (request.url === '/health' || request.url === '/ready') return;
      const provided = request.headers['x-internal-service-key'];
      if (provided !== internalKey) {
        await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '내부 서비스 인증 실패' },
        });
      }
    });
  }

  // CSAP D-08-06: Rate Limiting
  const readLimiter = createRateLimiter(100, 60, 'rl:ai:read');
  const writeLimiter = createRateLimiter(20, 60, 'rl:ai:write');
  const chatLimiter = createRateLimiter(10, 60, 'rl:ai:chat');
  const embedLimiter = createRateLimiter(30, 60, 'rl:ai:embed');
  const ragLimiter = createRateLimiter(20, 60, 'rl:ai:rag');
  const agentLimiter = createRateLimiter(5, 60, 'rl:ai:agent'); // 에이전트는 비용이 높아 제한
  const workflowLimiter = createRateLimiter(10, 60, 'rl:ai:workflow');

  // OpenAPI JSON Schema 공통 정의
  const modelResponse = {
    type: 'object' as const,
    properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const } },
  };
  const listResponse = {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean' as const },
      data: { type: 'array' as const, items: { type: 'object' as const } },
    },
  };
  const errorResponse = {
    type: 'object' as const,
    properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const } },
  };
  const idParam = { type: 'object' as const, properties: { id: { type: 'string' as const, format: 'uuid' } } };

  // ── 모델 관리 ──────────────────────────────────────────────────

  app.get(
    '/ai/models',
    { schema: { description: 'AI 모델 목록 조회', tags: ['ai'], response: { 200: listResponse } }, preHandler: readLimiter },
    listModelsHandler as never,
  );

  app.post(
    '/ai/models',
    {
      schema: {
        description: 'AI 모델 등록 (provider: lmstudio|openai|ollama|vllm)',
        tags: ['ai'],
        body: {
          type: 'object' as const,
          required: ['name', 'provider', 'endpoint'] as const,
          properties: {
            name: { type: 'string' as const },
            provider: { type: 'string' as const, enum: ['lmstudio', 'openai', 'ollama', 'vllm'] },
            endpoint: { type: 'string' as const, format: 'uri' },
            maxGrade: { type: 'string' as const, enum: ['O'] },
            config: { type: 'object' as const, description: 'modelId, modelType, isThinking, maxTokens, temperature' },
          },
        },
        response: { 201: modelResponse },
      },
      preHandler: writeLimiter,
    },
    createModelHandler as never,
  );

  app.put(
    '/ai/models/:id',
    {
      schema: {
        description: 'AI 모델 수정',
        tags: ['ai'],
        params: idParam,
        body: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const },
            endpoint: { type: 'string' as const },
            isActive: { type: 'boolean' as const },
            config: { type: 'object' as const },
          },
        },
        response: { 200: modelResponse },
      },
      preHandler: writeLimiter,
    },
    updateModelHandler as never,
  );

  // ── 채팅 (일반 + 스트리밍) ────────────────────────────────────

  app.post(
    '/ai/chat',
    {
      schema: {
        description: 'AI 채팅 (N2SF O등급, PII 마스킹, 멀티모달 이미지 지원)',
        tags: ['ai'],
        body: {
          type: 'object' as const,
          required: ['modelId', 'tenantId', 'message', 'grade'] as const,
          properties: {
            modelId: { type: 'string' as const },
            tenantId: { type: 'string' as const },
            message: { type: 'string' as const, maxLength: 8192 },
            grade: { type: 'string' as const, enum: ['O'] },
            images: { type: 'array' as const, items: { type: 'string' as const }, maxItems: 5 },
            systemPrompt: { type: 'string' as const, maxLength: 2048 },
          },
        },
        response: { 200: modelResponse, 403: errorResponse, 502: errorResponse },
      },
      preHandler: chatLimiter,
    },
    chatHandler as never,
  );

  // FR-AI-R3.1: SSE 스트리밍 채팅
  app.post(
    '/ai/chat/stream',
    {
      schema: {
        description: 'AI 채팅 스트리밍 (SSE, text/event-stream)',
        tags: ['ai'],
        body: {
          type: 'object' as const,
          required: ['modelId', 'tenantId', 'message', 'grade'] as const,
          properties: {
            modelId: { type: 'string' as const },
            tenantId: { type: 'string' as const },
            message: { type: 'string' as const, maxLength: 8192 },
            grade: { type: 'string' as const, enum: ['O'] },
            systemPrompt: { type: 'string' as const, maxLength: 2048 },
          },
        },
      },
      preHandler: chatLimiter,
    },
    chatStreamHandler as never,
  );

  // ── 임베딩 ───────────────────────────────────────────────────

  // FR-AI-R3.2: 텍스트 임베딩
  app.post(
    '/ai/embed',
    {
      schema: {
        description: '텍스트 임베딩 벡터 생성 (text-embedding-qwen3, nomic-embed 등)',
        tags: ['ai'],
        body: {
          type: 'object' as const,
          required: ['modelId', 'tenantId', 'texts', 'grade'] as const,
          properties: {
            modelId: { type: 'string' as const },
            tenantId: { type: 'string' as const },
            texts: { type: 'array' as const, items: { type: 'string' as const }, minItems: 1, maxItems: 100 },
            grade: { type: 'string' as const, enum: ['O'] },
          },
        },
        response: { 200: modelResponse, 403: errorResponse, 502: errorResponse },
      },
      preHandler: embedLimiter,
    },
    embedHandler as never,
  );

  // ── 사용량 / 비용 ─────────────────────────────────────────────

  app.get(
    '/ai/usage',
    { schema: { description: 'AI 사용량 조회', tags: ['ai'], response: { 200: modelResponse } }, preHandler: readLimiter },
    usageHandler as never,
  );

  app.get(
    '/ai/cost',
    { schema: { description: 'AI 비용 조회', tags: ['ai'], response: { 200: modelResponse } }, preHandler: readLimiter },
    costHandler as never,
  );

  // ── 분석 ─────────────────────────────────────────────────────

  app.get(
    '/ai/analytics/trend',
    {
      schema: {
        description: '일별 AI 사용량 추이',
        tags: ['ai'],
        querystring: { type: 'object' as const, properties: { days: { type: 'integer' as const, default: 30 } } },
        response: { 200: modelResponse },
      },
      preHandler: readLimiter,
    },
    aiUsageTrendHandler as never,
  );

  app.get(
    '/ai/analytics/models',
    { schema: { description: '모델별 사용 분석', tags: ['ai'], response: { 200: listResponse } }, preHandler: readLimiter },
    modelAnalyticsHandler as never,
  );

  // ── 제공자 관리 (FR-AI-R3.3, FR-AI-R3.4) ────────────────────

  // FR-AI-R3.4: LLM 제공자 헬스체크
  app.get(
    '/ai/provider/health',
    { schema: { description: 'LLM 제공자 헬스체크 (응답시간, 모델 목록)', tags: ['ai'], response: { 200: modelResponse } }, preHandler: readLimiter },
    providerHealthHandler as never,
  );

  // FR-AI-R3.3: LLM 서버 모델 목록 + 타입 분류
  app.get(
    '/ai/provider/models',
    { schema: { description: 'LLM 서버 로드된 모델 목록 + 자동 타입 분류', tags: ['ai'], response: { 200: modelResponse } }, preHandler: readLimiter },
    providerModelsHandler as never,
  );

  // ── SVC-AI-2026: RAG 지식베이스 (FR-AI26.1) ────────────────

  app.post(
    '/ai/rag/ingest',
    {
      schema: {
        description: 'RAG 지식베이스 문서 수집 (청킹 + 임베딩 + 벡터 저장)',
        tags: ['ai', 'rag'],
        body: {
          type: 'object' as const,
          required: ['tenantId', 'grade', 'title', 'content'] as const,
          properties: {
            tenantId: { type: 'string' as const, format: 'uuid' },
            grade: { type: 'string' as const, enum: ['O'] },
            title: { type: 'string' as const, maxLength: 200 },
            content: { type: 'string' as const, maxLength: 500000 },
            sourceUrl: { type: 'string' as const, format: 'uri' },
            embedModelId: { type: 'string' as const },
          },
        },
        response: { 200: modelResponse, 403: errorResponse, 500: errorResponse },
      },
      preHandler: ragLimiter,
    },
    ragIngestHandler as never,
  );

  app.post(
    '/ai/rag/query',
    {
      schema: {
        description: 'RAG 질의: 지식베이스 검색 + LLM 생성 + 출처 인용',
        tags: ['ai', 'rag'],
        body: {
          type: 'object' as const,
          required: ['tenantId', 'grade', 'question'] as const,
          properties: {
            tenantId: { type: 'string' as const, format: 'uuid' },
            grade: { type: 'string' as const, enum: ['O'] },
            question: { type: 'string' as const, maxLength: 2000 },
            topK: { type: 'integer' as const, minimum: 1, maximum: 20, default: 5 },
            minScore: { type: 'number' as const, minimum: 0, maximum: 1, default: 0.25 },
            embedModelId: { type: 'string' as const },
            chatModelId: { type: 'string' as const },
          },
        },
        response: { 200: modelResponse, 403: errorResponse, 502: errorResponse },
      },
      preHandler: chatLimiter,
    },
    ragQueryHandler as never,
  );

  // ── SVC-AI-2026: ReAct 에이전트 (FR-AI26.2) ─────────────────

  app.post(
    '/ai/agent',
    {
      schema: {
        description: 'ReAct 패턴 AI 에이전트 (Thought→Action→Observation→Answer, 최대 10단계)',
        tags: ['ai', 'agent'],
        body: {
          type: 'object' as const,
          required: ['tenantId', 'grade', 'query'] as const,
          properties: {
            tenantId: { type: 'string' as const, format: 'uuid' },
            grade: { type: 'string' as const, enum: ['O'] },
            query: { type: 'string' as const, maxLength: 4000 },
            maxIterations: { type: 'integer' as const, minimum: 1, maximum: 10, default: 10 },
            tools: { type: 'array' as const, items: { type: 'string' as const } },
            modelId: { type: 'string' as const },
          },
        },
        response: { 200: modelResponse, 403: errorResponse, 502: errorResponse },
      },
      preHandler: agentLimiter,
    },
    agentHandler as never,
  );

  // ── SVC-AI-2026: 구조화 출력 (FR-AI26.3) ────────────────────

  app.post(
    '/ai/structured',
    {
      schema: {
        description: 'JSON 스키마 제약 구조화 출력 (citizen_request|document_analysis|meeting_summary|risk_assessment)',
        tags: ['ai'],
        body: {
          type: 'object' as const,
          required: ['tenantId', 'grade', 'schema', 'inputText'] as const,
          properties: {
            tenantId: { type: 'string' as const, format: 'uuid' },
            grade: { type: 'string' as const, enum: ['O'] },
            schema: {
              type: 'string' as const,
              enum: ['citizen_request', 'document_analysis', 'meeting_summary', 'risk_assessment'],
            },
            inputText: { type: 'string' as const, maxLength: 100000 },
            modelId: { type: 'string' as const },
          },
        },
        response: { 200: modelResponse, 403: errorResponse, 422: errorResponse, 502: errorResponse },
      },
      preHandler: chatLimiter,
    },
    structuredOutputHandler as never,
  );

  // ── SVC-AI-2026: 장문서 분석 (FR-AI26.4) ────────────────────

  app.post(
    '/ai/document/analyze',
    {
      schema: {
        description: '장문 공공문서 AI 분석 (summary|risk|extract|classify|full)',
        tags: ['ai', 'document'],
        body: {
          type: 'object' as const,
          required: ['tenantId', 'grade', 'content'] as const,
          properties: {
            tenantId: { type: 'string' as const, format: 'uuid' },
            grade: { type: 'string' as const, enum: ['O'] },
            content: { type: 'string' as const, maxLength: 300000 },
            analysisType: {
              type: 'string' as const,
              enum: ['summary', 'risk', 'extract', 'classify', 'full'],
              default: 'full',
            },
            docType: { type: 'string' as const, maxLength: 50 },
            modelId: { type: 'string' as const },
          },
        },
        response: { 200: modelResponse, 403: errorResponse, 502: errorResponse },
      },
      preHandler: ragLimiter,
    },
    documentAnalyzeHandler as never,
  );

  app.post(
    '/ai/document/compare',
    {
      schema: {
        description: '두 공공문서 비교 분석',
        tags: ['ai', 'document'],
        body: {
          type: 'object' as const,
          required: ['tenantId', 'grade', 'documentA', 'documentB'] as const,
          properties: {
            tenantId: { type: 'string' as const, format: 'uuid' },
            grade: { type: 'string' as const, enum: ['O'] },
            documentA: { type: 'string' as const, maxLength: 150000 },
            documentB: { type: 'string' as const, maxLength: 150000 },
            compareAspects: { type: 'array' as const, items: { type: 'string' as const }, maxItems: 10 },
            modelId: { type: 'string' as const },
          },
        },
        response: { 200: modelResponse, 403: errorResponse, 502: errorResponse },
      },
      preHandler: ragLimiter,
    },
    documentCompareHandler as never,
  );

  // ── SVC-AI-2026: 멀티스텝 워크플로우 (FR-AI26.5) ────────────

  app.post(
    '/ai/workflow',
    {
      schema: {
        description: 'AI 멀티스텝 워크플로우 (citizen_request|document_review|meeting_assist|policy_draft)',
        tags: ['ai', 'workflow'],
        body: {
          type: 'object' as const,
          required: ['tenantId', 'grade', 'workflowType', 'inputData'] as const,
          properties: {
            tenantId: { type: 'string' as const, format: 'uuid' },
            grade: { type: 'string' as const, enum: ['O'] },
            workflowType: {
              type: 'string' as const,
              enum: ['citizen_request', 'document_review', 'meeting_assist', 'policy_draft'],
            },
            inputData: { type: 'object' as const, description: '워크플로우별 입력 데이터' },
            modelId: { type: 'string' as const },
          },
        },
        response: { 200: modelResponse, 403: errorResponse, 502: errorResponse },
      },
      preHandler: workflowLimiter,
    },
    workflowHandler as never,
  );
}
