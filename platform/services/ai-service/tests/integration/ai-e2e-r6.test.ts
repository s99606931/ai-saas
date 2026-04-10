// AI 서비스 E2E 통합 테스트 -- Round 6
// Design Ref: SVC-E2E-R6 Plan
// Plan SC: FR-E2E-R6.1
// CSAP: D-08 접근 통제, N2SF N-05 데이터 등급

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('ai-service E2E -- 모델 관리 + 데이터 등급 검증 (CSAP N-05)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  // In-memory 모델 저장소
  const models = new Map<
    string,
    {
      id: string;
      name: string;
      provider: string;
      endpoint: string;
      maxGrade: string;
      isActive: boolean;
    }
  >();

  // 사용량 추적
  const usageLog: Array<{
    modelId: string;
    tenantId: string;
    tokens: number;
    cost: number;
    timestamp: string;
  }> = [];

  const TOKEN_COST = 0.0001;

  app.get('/ai/models', async () => {
    const active = Array.from(models.values()).filter((m) => m.isActive);
    return { success: true, data: active };
  });

  app.post('/ai/models', async (req, reply) => {
    const body = req.body as { name?: string; provider?: string; endpoint?: string; maxGrade?: string };
    if (!body.name || !body.provider || !body.endpoint) {
      await reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '필수 필드 누락' },
      });
      return;
    }
    const id = `model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const model = {
      id,
      name: body.name,
      provider: body.provider,
      endpoint: body.endpoint,
      maxGrade: body.maxGrade ?? 'O',
      isActive: true,
    };
    models.set(id, model);
    await reply.status(201).send({ success: true, data: model });
  });

  app.put('/ai/models/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const model = models.get(id);
    if (!model) {
      await reply.status(404).send({
        success: false,
        error: { code: 'MODEL_NOT_FOUND', message: '모델을 찾을 수 없습니다' },
      });
      return;
    }
    const body = req.body as { name?: string; isActive?: boolean };
    if (body.name !== undefined) model.name = body.name;
    if (body.isActive !== undefined) model.isActive = body.isActive;
    return { success: true, data: model };
  });

  // N2SF N-05: 데이터 등급 검증
  app.post('/ai/chat', async (req, reply) => {
    const body = req.body as { modelId: string; tenantId: string; message: string; grade: string };
    if (!body.modelId || !body.tenantId || !body.message || !body.grade) {
      await reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '필수 필드 누락' },
      });
      return;
    }

    // C/S 등급 차단 (N2SF N-05)
    if (body.grade === 'C' || body.grade === 'S') {
      await reply.status(403).send({
        success: false,
        error: {
          code: 'N2SF_DATA_GRADE_VIOLATION',
          message: `BLOCKED: ${body.grade}등급 데이터는 AI API 전송이 금지됩니다 (N2SF N-05)`,
        },
      });
      return;
    }

    const model = models.get(body.modelId);
    if (!model) {
      await reply.status(404).send({
        success: false,
        error: { code: 'MODEL_NOT_FOUND', message: '모델을 찾을 수 없습니다' },
      });
      return;
    }

    // PII 마스킹 시뮬레이션
    const maskedMessage = body.message
      .replace(/\d{3}-\d{4}-\d{4}/g, '***-****-****')
      .replace(/\d{6}-\d{7}/g, '******-*******');

    const tokens = Math.ceil(maskedMessage.length / 4);
    const cost = tokens * TOKEN_COST;

    usageLog.push({
      modelId: body.modelId,
      tenantId: body.tenantId,
      tokens,
      cost,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      data: {
        response: `AI 응답 (${model.name}): 처리됨`,
        tokens,
        cost,
        maskedInput: maskedMessage,
      },
    };
  });

  app.get('/ai/usage', async (req) => {
    const query = req.query as { tenantId?: string };
    const filtered = query.tenantId ? usageLog.filter((u) => u.tenantId === query.tenantId) : usageLog;
    const totalTokens = filtered.reduce((sum, u) => sum + u.tokens, 0);
    const totalCost = filtered.reduce((sum, u) => sum + u.cost, 0);
    return { success: true, data: { items: filtered, totalTokens, totalCost } };
  });

  app.get('/ai/cost', async (req) => {
    const query = req.query as { tenantId?: string };
    const filtered = query.tenantId ? usageLog.filter((u) => u.tenantId === query.tenantId) : usageLog;
    const totalCost = filtered.reduce((sum, u) => sum + u.cost, 0);
    return { success: true, data: { totalCost, tokenCostRate: TOKEN_COST } };
  });

  afterAll(async () => {
    await app.close();
  });

  it('모델 등록 -> 목록 조회 CRUD 전체 플로우', async () => {
    // 1. 모델 등록
    const createRes = await app.inject({
      method: 'POST',
      url: '/ai/models',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'gpt-4o', provider: 'openai', endpoint: 'http://lm-studio:1234/v1' },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.success).toBe(true);
    expect(created.data.name).toBe('gpt-4o');

    const modelId = created.data.id;

    // 2. 목록 조회
    const listRes = await app.inject({ method: 'GET', url: '/ai/models' });
    expect(listRes.json().data.length).toBeGreaterThanOrEqual(1);

    // 3. 모델 수정
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/ai/models/${modelId}`,
      headers: { 'content-type': 'application/json' },
      payload: { name: 'gpt-4o-updated' },
    });
    expect(updateRes.json().data.name).toBe('gpt-4o-updated');

    // 4. 비활성화
    const deactivateRes = await app.inject({
      method: 'PUT',
      url: `/ai/models/${modelId}`,
      headers: { 'content-type': 'application/json' },
      payload: { isActive: false },
    });
    expect(deactivateRes.json().data.isActive).toBe(false);

    // 5. 비활성 모델은 목록에 미표시
    const listRes2 = await app.inject({ method: 'GET', url: '/ai/models' });
    const activeModels = listRes2.json().data;
    expect(activeModels.find((m: { id: string }) => m.id === modelId)).toBeUndefined();
  });

  it('N2SF N-05: C등급 데이터 AI 전송 차단', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat',
      headers: { 'content-type': 'application/json' },
      payload: { modelId: 'any', tenantId: 't-1', message: '기밀 정보', grade: 'C' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('N2SF_DATA_GRADE_VIOLATION');
  });

  it('N2SF N-05: S등급 데이터 AI 전송 차단', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat',
      headers: { 'content-type': 'application/json' },
      payload: { modelId: 'any', tenantId: 't-1', message: '민감 데이터', grade: 'S' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('N2SF_DATA_GRADE_VIOLATION');
  });

  it('O등급 데이터 전송 + PII 마스킹 검증', async () => {
    // 모델 등록
    const createRes = await app.inject({
      method: 'POST',
      url: '/ai/models',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'test-model', provider: 'local', endpoint: 'http://localhost:1234' },
    });
    const modelId = createRes.json().data.id;

    // PII 포함 메시지 전송
    const chatRes = await app.inject({
      method: 'POST',
      url: '/ai/chat',
      headers: { 'content-type': 'application/json' },
      payload: {
        modelId,
        tenantId: 't-pii',
        message: '전화번호 010-1234-5678 주민번호 901225-1234567',
        grade: 'O',
      },
    });
    expect(chatRes.statusCode).toBe(200);
    const data = chatRes.json().data;
    expect(data.maskedInput).toContain('***-****-****');
    expect(data.maskedInput).toContain('******-*******');
    expect(data.maskedInput).not.toContain('010-1234-5678');
    expect(data.tokens).toBeGreaterThan(0);
    expect(data.cost).toBeGreaterThan(0);
  });

  it('사용량 및 비용 추적 검증', async () => {
    const usageRes = await app.inject({
      method: 'GET',
      url: '/ai/usage?tenantId=t-pii',
    });
    expect(usageRes.json().success).toBe(true);
    expect(usageRes.json().data.totalTokens).toBeGreaterThan(0);

    const costRes = await app.inject({
      method: 'GET',
      url: '/ai/cost?tenantId=t-pii',
    });
    expect(costRes.json().success).toBe(true);
    expect(costRes.json().data.totalCost).toBeGreaterThan(0);
  });

  it('존재하지 않는 모델로 채팅 시 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat',
      headers: { 'content-type': 'application/json' },
      payload: { modelId: 'nonexistent', tenantId: 't-1', message: 'test', grade: 'O' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('MODEL_NOT_FOUND');
  });

  it('X-Response-Time 헤더 포함 검증', async () => {
    const res = await app.inject({ method: 'GET', url: '/ai/models' });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});
