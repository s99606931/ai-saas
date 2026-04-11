// SVC-AI-ADV-R37 단위 테스트: AI 거버넌스 메트릭
// Design Ref: SVC-AI-ADV-R37 DESIGN §1~§4, §6
// Plan SC: FR-ADV37.1~37.4, FR-ADV37.6
// CSAP: D-06 AI 감사 메트릭, AI 윤리 준수

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  AIGovernanceMetrics,
  getAIGovernanceMetrics,
  resetAIGovernanceMetrics,
} from '../../src/lib/ai-governance-metrics.js';
import type { AICallEvent, QualityFeedback, EthicsEvent } from '../../src/lib/ai-governance-metrics.js';

function createCallEvent(overrides?: Partial<AICallEvent>): AICallEvent {
  return {
    requestId: `req-${Math.random().toString(36).slice(2, 8)}`,
    model: 'claude-sonnet-4-6',
    tenantId: 'tenant-1',
    inputTokens: 500,
    outputTokens: 200,
    latencyMs: 1200,
    success: true,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createFeedback(overrides?: Partial<QualityFeedback>): QualityFeedback {
  return {
    requestId: `req-${Math.random().toString(36).slice(2, 8)}`,
    model: 'claude-sonnet-4-6',
    tenantId: 'tenant-1',
    hallucinationDetected: false,
    relevanceScore: 0.85,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createEthicsEvent(overrides?: Partial<EthicsEvent>): EthicsEvent {
  return {
    requestId: `req-${Math.random().toString(36).slice(2, 8)}`,
    model: 'claude-sonnet-4-6',
    category: 'general',
    biasScore: 0.1,
    explainabilityScore: 0.8,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// -- 사용 메트릭 집계 -- Design §1 -----------------------------------------------

describe('AIGovernanceMetrics 사용 메트릭 (FR-ADV37.1)', () => {
  let metrics: AIGovernanceMetrics;

  beforeEach(() => {
    metrics = new AIGovernanceMetrics();
  });

  it('호출 이벤트를 기록한다', () => {
    metrics.recordCall(createCallEvent());
    const usage = metrics.getUsageMetrics();
    expect(usage).toHaveLength(1);
    expect(usage[0]!.totalCalls).toBe(1);
  });

  it('모델별로 집계한다', () => {
    metrics.recordCall(createCallEvent({ model: 'claude-sonnet-4-6' }));
    metrics.recordCall(createCallEvent({ model: 'claude-sonnet-4-6' }));
    metrics.recordCall(createCallEvent({ model: 'gpt-4o' }));
    const usage = metrics.getUsageMetrics();
    expect(usage).toHaveLength(2);
  });

  it('에러율을 계산한다', () => {
    metrics.recordCall(createCallEvent({ success: true }));
    metrics.recordCall(createCallEvent({ success: true }));
    metrics.recordCall(createCallEvent({ success: false }));
    const usage = metrics.getUsageMetrics();
    expect(usage[0]!.errorRate).toBeCloseTo(33.33, 0);
  });

  it('P95 지연시간을 계산한다', () => {
    for (let i = 0; i < 100; i++) {
      metrics.recordCall(createCallEvent({ latencyMs: 100 + i }));
    }
    const usage = metrics.getUsageMetrics();
    expect(usage[0]!.p95LatencyMs).toBeGreaterThanOrEqual(190);
  });

  it('토큰 합계를 집계한다', () => {
    metrics.recordCall(createCallEvent({ inputTokens: 1000, outputTokens: 500 }));
    metrics.recordCall(createCallEvent({ inputTokens: 2000, outputTokens: 1000 }));
    const usage = metrics.getUsageMetrics();
    expect(usage[0]!.totalInputTokens).toBe(3000);
    expect(usage[0]!.totalOutputTokens).toBe(1500);
  });

  it('특정 모델로 필터링한다', () => {
    metrics.recordCall(createCallEvent({ model: 'model-a' }));
    metrics.recordCall(createCallEvent({ model: 'model-b' }));
    const usage = metrics.getUsageMetrics('model-a');
    expect(usage).toHaveLength(1);
    expect(usage[0]!.model).toBe('model-a');
  });

  it('이벤트 없으면 빈 결과', () => {
    expect(metrics.getUsageMetrics()).toHaveLength(0);
  });
});

// -- 비용 메트릭 -- Design §2 ---------------------------------------------------

describe('AIGovernanceMetrics 비용 메트릭 (FR-ADV37.2)', () => {
  let metrics: AIGovernanceMetrics;

  beforeEach(() => {
    metrics = new AIGovernanceMetrics();
  });

  it('비용을 계산한다', () => {
    metrics.recordCall(createCallEvent({
      model: 'claude-sonnet-4-6',
      inputTokens: 1000,
      outputTokens: 1000,
    }));
    const cost = metrics.getCostMetrics();
    expect(cost).toHaveLength(1);
    expect(cost[0]!.totalCost).toBeGreaterThan(0);
    expect(cost[0]!.inputCost).toBeGreaterThan(0);
    expect(cost[0]!.outputCost).toBeGreaterThan(0);
  });

  it('테넌트별로 필터링한다', () => {
    metrics.recordCall(createCallEvent({ tenantId: 'tenant-A' }));
    metrics.recordCall(createCallEvent({ tenantId: 'tenant-B' }));
    const cost = metrics.getCostMetrics('tenant-A');
    expect(cost).toHaveLength(1);
  });

  it('로컬 모델은 비용 0', () => {
    metrics.recordCall(createCallEvent({
      model: 'local-ollama',
      inputTokens: 10000,
      outputTokens: 5000,
    }));
    const cost = metrics.getCostMetrics();
    expect(cost[0]!.totalCost).toBe(0);
  });
});

// -- 품질 메트릭 -- Design §3 ---------------------------------------------------

describe('AIGovernanceMetrics 품질 메트릭 (FR-ADV37.3)', () => {
  let metrics: AIGovernanceMetrics;

  beforeEach(() => {
    metrics = new AIGovernanceMetrics();
  });

  it('환각률을 계산한다', () => {
    metrics.recordFeedback(createFeedback({ hallucinationDetected: true }));
    metrics.recordFeedback(createFeedback({ hallucinationDetected: false }));
    metrics.recordFeedback(createFeedback({ hallucinationDetected: false }));
    const quality = metrics.getQualityMetrics();
    expect(quality[0]!.hallucinationRate).toBeCloseTo(33.33, 0);
  });

  it('평균 관련성 점수를 계산한다', () => {
    metrics.recordFeedback(createFeedback({ relevanceScore: 0.8 }));
    metrics.recordFeedback(createFeedback({ relevanceScore: 0.9 }));
    const quality = metrics.getQualityMetrics();
    expect(quality[0]!.avgRelevance).toBeCloseTo(0.85, 2);
  });

  it('사용자 만족도를 계산한다', () => {
    metrics.recordFeedback(createFeedback({ userSatisfaction: 4 }));
    metrics.recordFeedback(createFeedback({ userSatisfaction: 5 }));
    const quality = metrics.getQualityMetrics();
    expect(quality[0]!.avgSatisfaction).toBeCloseTo(4.5, 1);
  });

  it('피드백 없으면 빈 결과', () => {
    expect(metrics.getQualityMetrics()).toHaveLength(0);
  });
});

// -- 윤리 지표 -- Design §4 ---------------------------------------------------

describe('AIGovernanceMetrics 윤리 지표 (FR-ADV37.4)', () => {
  let metrics: AIGovernanceMetrics;

  beforeEach(() => {
    metrics = new AIGovernanceMetrics();
  });

  it('편향 점수를 집계한다', () => {
    metrics.recordEthicsEvent(createEthicsEvent({ biasScore: 0.1 }));
    metrics.recordEthicsEvent(createEthicsEvent({ biasScore: 0.3 }));
    const ethics = metrics.getEthicsMetrics();
    expect(ethics.avgBiasScore).toBeCloseTo(0.2, 2);
  });

  it('공정성 지수를 계산한다 (1 - bias)', () => {
    metrics.recordEthicsEvent(createEthicsEvent({ biasScore: 0.2 }));
    const ethics = metrics.getEthicsMetrics();
    expect(ethics.fairnessIndex).toBeCloseTo(0.8, 2);
  });

  it('투명성률을 계산한다', () => {
    metrics.recordEthicsEvent(createEthicsEvent({ explainabilityScore: 0.9 }));
    metrics.recordEthicsEvent(createEthicsEvent({ explainabilityScore: 0.5 }));
    const ethics = metrics.getEthicsMetrics();
    // 0.9 > 0.7 → 1/2 = 50%
    expect(ethics.transparencyRate).toBeCloseTo(50, 0);
  });

  it('이벤트 없으면 기본값', () => {
    const ethics = metrics.getEthicsMetrics();
    expect(ethics.totalEvents).toBe(0);
    expect(ethics.fairnessIndex).toBe(1);
  });
});

// -- 알림 -- Design §6 --------------------------------------------------------

describe('AIGovernanceMetrics 알림 (FR-ADV37.6)', () => {
  let metrics: AIGovernanceMetrics;

  beforeEach(() => {
    metrics = new AIGovernanceMetrics();
  });

  it('에러율 초과 시 알림을 생성한다', () => {
    for (let i = 0; i < 10; i++) {
      metrics.recordCall(createCallEvent({ success: i < 4 })); // 60% 에러율
    }
    const alerts = metrics.checkAlerts();
    expect(alerts.some((a) => a.metric === 'errorRate')).toBe(true);
  });

  it('편향 점수 초과 시 알림을 생성한다', () => {
    metrics.recordEthicsEvent(createEthicsEvent({ biasScore: 0.5 }));
    const alerts = metrics.checkAlerts();
    expect(alerts.some((a) => a.metric === 'biasScore')).toBe(true);
    expect(alerts.some((a) => a.severity === 'critical')).toBe(true);
  });

  it('정상 상태에서는 알림 없음', () => {
    metrics.recordCall(createCallEvent({ success: true, latencyMs: 100 }));
    metrics.recordFeedback(createFeedback({ hallucinationDetected: false }));
    metrics.recordEthicsEvent(createEthicsEvent({ biasScore: 0.05 }));
    const alerts = metrics.checkAlerts();
    expect(alerts).toHaveLength(0);
  });

  it('알림 콜백을 호출한다', () => {
    const received: unknown[] = [];
    metrics.onAlert((alert) => received.push(alert));

    for (let i = 0; i < 10; i++) {
      metrics.recordCall(createCallEvent({ success: false }));
    }
    metrics.checkAlerts();
    expect(received.length).toBeGreaterThan(0);
  });
});

// -- 이벤트 정리 ---------------------------------------------------------------

describe('AIGovernanceMetrics 이벤트 정리', () => {
  it('보존 기간 이전 이벤트를 정리한다', () => {
    const metrics = new AIGovernanceMetrics();
    const oldTime = new Date(Date.now() - 100 * 86400_000).toISOString();
    const newTime = new Date().toISOString();

    metrics.recordCall(createCallEvent({ timestamp: oldTime }));
    metrics.recordCall(createCallEvent({ timestamp: newTime }));

    metrics.purgeEvents(30);
    const usage = metrics.getUsageMetrics();
    expect(usage[0]!.totalCalls).toBe(1);
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('AIGovernanceMetrics 팩토리', () => {
  afterEach(() => {
    resetAIGovernanceMetrics();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const m1 = getAIGovernanceMetrics();
    const m2 = getAIGovernanceMetrics();
    expect(m1).toBe(m2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const m1 = getAIGovernanceMetrics();
    resetAIGovernanceMetrics();
    const m2 = getAIGovernanceMetrics();
    expect(m1).not.toBe(m2);
  });
});
