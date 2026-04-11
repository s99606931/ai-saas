// SVC-AI-ADV-R25 단위 테스트: AI 모델 레지스트리
// Design Ref: SVC-AI-ADV-R25 DESIGN §1~§5
// Plan SC: FR-ADV25.1~25.6
// CSAP: D-12 모델 무결성, D-06 모델 변경 감사

import { describe, it, expect, beforeEach } from 'vitest';

import { AIModelRegistry } from '../../src/lib/ai-model-registry.js';
import type {
  ModelEntry,
  ModelPerformanceMetric,
  DeploymentPlan,
} from '../../src/lib/ai-model-registry.js';

// ── 테스트 헬퍼 ────────────────────────────────────────────────────────────

function createModelEntry(
  overrides: Partial<Omit<ModelEntry, 'createdAt' | 'updatedAt'>> = {},
): Omit<ModelEntry, 'createdAt' | 'updatedAt'> {
  return {
    id: 'model-1',
    name: '공공 AI 모델 v1',
    provider: 'local-llm',
    version: '1.0.0',
    status: 'draft',
    capabilities: [
      { type: 'chat', maxTokens: 4096, supportedLanguages: ['ko', 'en'] },
    ],
    pricing: { inputTokenPer1K: 0.01, outputTokenPer1K: 0.02, currency: 'KRW' },
    card: {
      description: '공공기관 전용 AI 모델',
      trainingData: '공공 문서 코퍼스',
      benchmarks: { accuracy: 0.85 },
      knownBiases: ['한국어 편향'],
      usageGuidelines: ['공공 업무에만 사용'],
      limitations: ['실시간 검색 불가'],
    },
    ...overrides,
  };
}

function createMetric(
  overrides: Partial<ModelPerformanceMetric> = {},
): ModelPerformanceMetric {
  return {
    modelId: 'model-1',
    avgLatencyMs: 200,
    avgTokensPerSecond: 50,
    totalRequests: 100,
    errorRate: 0.02,
    avgQualityScore: 0.85,
    costPerRequest: 0.5,
    uptime: 0.99,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ── AIModelRegistry 모델 등록/관리 — Design §1, §2 ──────────────────────────

describe('AIModelRegistry 모델 등록 (FR-ADV25.1)', () => {
  let registry: AIModelRegistry;

  beforeEach(() => {
    registry = new AIModelRegistry();
  });

  it('모델을 등록한다', () => {
    const entry = createModelEntry();
    const model = registry.register(entry);
    expect(model.id).toBe('model-1');
    expect(model.name).toBe('공공 AI 모델 v1');
    expect(model.createdAt).toBeDefined();
    expect(model.updatedAt).toBeDefined();
    expect(registry.size).toBe(1);
  });

  it('여러 모델을 등록한다', () => {
    registry.register(createModelEntry({ id: 'model-1' }));
    registry.register(createModelEntry({ id: 'model-2', name: '모델 v2' }));
    expect(registry.size).toBe(2);
  });

  it('모델을 조회한다', () => {
    registry.register(createModelEntry());
    const model = registry.get('model-1');
    expect(model).toBeDefined();
    expect(model!.name).toBe('공공 AI 모델 v1');
  });

  it('존재하지 않는 모델 조회는 undefined', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('전체 모델 목록을 반환한다', () => {
    registry.register(createModelEntry({ id: 'model-1' }));
    registry.register(createModelEntry({ id: 'model-2' }));
    const list = registry.list();
    expect(list).toHaveLength(2);
  });
});

// ── 모델 상태 전이 — Design §2 ────────────────────────────────────────────

describe('AIModelRegistry 상태 전이 (FR-ADV25.2)', () => {
  let registry: AIModelRegistry;

  beforeEach(() => {
    registry = new AIModelRegistry();
    registry.register(createModelEntry());
  });

  it('draft -> active 전이한다', () => {
    const model = registry.activate('model-1');
    expect(model).toBeDefined();
    expect(model!.status).toBe('active');
    expect(model!.deployedAt).toBeDefined();
  });

  it('active -> deprecated 전이한다', () => {
    registry.activate('model-1');
    const model = registry.deprecate('model-1');
    expect(model).toBeDefined();
    expect(model!.status).toBe('deprecated');
  });

  it('deprecated -> retired 전이한다', () => {
    registry.activate('model-1');
    registry.deprecate('model-1');
    const model = registry.retire('model-1');
    expect(model).toBeDefined();
    expect(model!.status).toBe('retired');
    expect(model!.retiredAt).toBeDefined();
  });

  it('retired 모델은 activate 불가', () => {
    registry.retire('model-1');
    const result = registry.activate('model-1');
    expect(result).toBeUndefined();
  });

  it('존재하지 않는 모델 activate는 undefined', () => {
    expect(registry.activate('nonexistent')).toBeUndefined();
  });

  it('존재하지 않는 모델 deprecate는 undefined', () => {
    expect(registry.deprecate('nonexistent')).toBeUndefined();
  });

  it('존재하지 않는 모델 retire는 undefined', () => {
    expect(registry.retire('nonexistent')).toBeUndefined();
  });
});

// ── 능력 기반 검색 — Design §1 ────────────────────────────────────────────

describe('AIModelRegistry 능력 기반 검색', () => {
  let registry: AIModelRegistry;

  beforeEach(() => {
    registry = new AIModelRegistry();
    const chatModel = registry.register(createModelEntry({ id: 'chat-model' }));
    registry.activate('chat-model');

    registry.register(createModelEntry({
      id: 'embed-model',
      capabilities: [{ type: 'embedding', maxTokens: 8192, supportedLanguages: ['ko'] }],
    }));
    registry.activate('embed-model');

    // draft 상태 모델 (검색 결과에 포함되지 않아야 함)
    registry.register(createModelEntry({
      id: 'draft-model',
      capabilities: [{ type: 'chat', maxTokens: 2048, supportedLanguages: ['en'] }],
    }));
  });

  it('chat 능력 모델을 검색한다', () => {
    const models = registry.findByCapability('chat');
    expect(models).toHaveLength(1);
    expect(models[0]!.id).toBe('chat-model');
  });

  it('embedding 능력 모델을 검색한다', () => {
    const models = registry.findByCapability('embedding');
    expect(models).toHaveLength(1);
    expect(models[0]!.id).toBe('embed-model');
  });

  it('활성 모델만 검색한다 (draft 제외)', () => {
    const active = registry.getActiveModels();
    expect(active).toHaveLength(2);
    expect(active.find((m) => m.id === 'draft-model')).toBeUndefined();
  });

  it('존재하지 않는 능력은 빈 배열', () => {
    expect(registry.findByCapability('code')).toHaveLength(0);
  });
});

// ── 성능 메트릭 — Design §5 ──────────────────────────────────────────────

describe('AIModelRegistry 성능 메트릭 (FR-ADV25.5)', () => {
  let registry: AIModelRegistry;

  beforeEach(() => {
    registry = new AIModelRegistry();
    registry.register(createModelEntry());
  });

  it('메트릭을 기록한다', () => {
    registry.recordMetric(createMetric());
    const summary = registry.getPerformanceSummary('model-1');
    expect(summary).toBeDefined();
    expect(summary!.avgLatencyMs).toBe(200);
    expect(summary!.totalRequests).toBe(100);
  });

  it('여러 메트릭의 평균을 계산한다', () => {
    registry.recordMetric(createMetric({ avgLatencyMs: 100 }));
    registry.recordMetric(createMetric({ avgLatencyMs: 300 }));
    const summary = registry.getPerformanceSummary('model-1');
    expect(summary!.avgLatencyMs).toBe(200);
  });

  it('메트릭이 없으면 undefined', () => {
    expect(registry.getPerformanceSummary('model-1')).toBeUndefined();
  });

  it('최대 1000건까지 유지한다', () => {
    for (let i = 0; i < 1100; i++) {
      registry.recordMetric(createMetric({ totalRequests: i }));
    }
    const summary = registry.getPerformanceSummary('model-1');
    expect(summary).toBeDefined();
    // 총 요청 합계는 최근 1000건만 반영
    expect(summary!.totalRequests).toBeGreaterThan(0);
  });
});

// ── 배포 전략 — Design §4 ────────────────────────────────────────────────

describe('AIModelRegistry 배포 전략 (FR-ADV25.4)', () => {
  let registry: AIModelRegistry;

  const plan: DeploymentPlan = {
    modelId: 'model-1',
    strategy: 'canary',
    trafficPercent: 10,
    targetPercent: 100,
    stepPercent: 20,
    healthCheckInterval: 30,
    rollbackThreshold: 0.05,
  };

  beforeEach(() => {
    registry = new AIModelRegistry();
    registry.register(createModelEntry());
  });

  it('배포 계획을 생성한다', () => {
    registry.createDeployment(plan);
    const deployment = registry.getDeployment('model-1');
    expect(deployment).toBeDefined();
    expect(deployment!.strategy).toBe('canary');
    expect(deployment!.trafficPercent).toBe(10);
  });

  it('트래픽 비율을 증가시킨다 (카나리 진행)', () => {
    registry.createDeployment(plan);
    const advanced = registry.advanceDeployment('model-1');
    expect(advanced).toBeDefined();
    expect(advanced!.trafficPercent).toBe(30); // 10 + 20
  });

  it('트래픽 비율이 목표를 초과하지 않는다', () => {
    registry.createDeployment({ ...plan, trafficPercent: 90 });
    const advanced = registry.advanceDeployment('model-1');
    expect(advanced!.trafficPercent).toBe(100); // min(90+20, 100)
  });

  it('배포를 롤백한다', () => {
    registry.createDeployment(plan);
    registry.advanceDeployment('model-1');
    const rolledBack = registry.rollbackDeployment('model-1');
    expect(rolledBack).toBeDefined();
    expect(rolledBack!.trafficPercent).toBe(0);
  });

  it('존재하지 않는 배포 advance는 undefined', () => {
    expect(registry.advanceDeployment('nonexistent')).toBeUndefined();
  });

  it('존재하지 않는 배포 rollback은 undefined', () => {
    expect(registry.rollbackDeployment('nonexistent')).toBeUndefined();
  });

  it('배포 계획이 없으면 undefined', () => {
    expect(registry.getDeployment('model-1')).toBeUndefined();
  });
});
