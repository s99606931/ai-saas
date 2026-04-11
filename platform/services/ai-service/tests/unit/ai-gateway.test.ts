// SVC-AI-ADV-R27 단위 테스트: AI 게이트웨이
// Design Ref: SVC-AI-ADV-R27 DESIGN §1~§6
// Plan SC: FR-ADV27.1~27.6
// CSAP: D-08 제공자별 접근 통제, D-10 사용량 모니터링, D-06 감사

import { describe, it, expect, beforeEach } from 'vitest';

import {
  FallbackChain,
  CostTracker,
  calculateRoutingScore,
  selectBestProvider,
} from '../../src/lib/ai-gateway.js';
import type { LLMProvider, TokenPricing, RoutingScore } from '../../src/lib/ai-gateway.js';

// ── 테스트 헬퍼 ─────���──────────────────────────────────────────────────────

function createProvider(overrides: Partial<LLMProvider> = {}): LLMProvider {
  return {
    id: 'provider-1',
    name: 'Local LLM',
    baseUrl: 'http://localhost:1234',
    models: ['model-a', 'model-b'],
    status: 'active',
    priority: 1,
    maxConcurrency: 10,
    currentLoad: 0,
    consecutiveErrors: 0,
    ...overrides,
  };
}

// ── FallbackChain — Design §3 ────────────────────────────────────────────

describe('FallbackChain 폴백 체인 (FR-ADV27.3)', () => {
  let chain: FallbackChain;

  beforeEach(() => {
    chain = new FallbackChain();
  });

  it('제공자를 추가한다', () => {
    chain.addProvider(createProvider());
    expect(chain.list()).toHaveLength(1);
  });

  it('우선순위 순으로 정렬한다', () => {
    chain.addProvider(createProvider({ id: 'p2', priority: 3 }));
    chain.addProvider(createProvider({ id: 'p1', priority: 1 }));
    chain.addProvider(createProvider({ id: 'p3', priority: 2 }));
    const list = chain.list();
    expect(list[0]!.id).toBe('p1');
    expect(list[1]!.id).toBe('p3');
    expect(list[2]!.id).toBe('p2');
  });

  it('사용 가능한 다음 제공자를 선택한다', () => {
    chain.addProvider(createProvider({ id: 'p1', priority: 1 }));
    chain.addProvider(createProvider({ id: 'p2', priority: 2 }));
    const next = chain.getNextAvailable();
    expect(next).toBeDefined();
    expect(next!.id).toBe('p1');
  });

  it('비활성 제공자를 건너뛴다', () => {
    chain.addProvider(createProvider({ id: 'p1', priority: 1, status: 'down' }));
    chain.addProvider(createProvider({ id: 'p2', priority: 2 }));
    const next = chain.getNextAvailable();
    expect(next!.id).toBe('p2');
  });

  it('부하 초과 제공자를 건너뛴다', () => {
    chain.addProvider(createProvider({ id: 'p1', priority: 1, currentLoad: 10, maxConcurrency: 10 }));
    chain.addProvider(createProvider({ id: 'p2', priority: 2 }));
    const next = chain.getNextAvailable();
    expect(next!.id).toBe('p2');
  });

  it('제외 목록을 사용한다', () => {
    chain.addProvider(createProvider({ id: 'p1', priority: 1 }));
    chain.addProvider(createProvider({ id: 'p2', priority: 2 }));
    const next = chain.getNextAvailable(['p1']);
    expect(next!.id).toBe('p2');
  });

  it('사용 가능한 제공자가 없으면 undefined', () => {
    chain.addProvider(createProvider({ status: 'down' }));
    expect(chain.getNextAvailable()).toBeUndefined();
  });

  it('오류 기록 후 3회 이상이면 down 상태로 전환한다', () => {
    chain.addProvider(createProvider({ id: 'p1' }));
    chain.recordError('p1');
    chain.recordError('p1');
    chain.recordError('p1');
    const list = chain.list();
    expect(list[0]!.status).toBe('down');
  });

  it('성공 기록으로 오류 카운터를 리셋한다', () => {
    chain.addProvider(createProvider({ id: 'p1' }));
    chain.recordError('p1');
    chain.recordError('p1');
    chain.recordSuccess('p1');
    const list = chain.list();
    expect(list[0]!.consecutiveErrors).toBe(0);
  });

  it('성공 기록으로 degraded -> active 복구한다', () => {
    chain.addProvider(createProvider({ id: 'p1', status: 'degraded' }));
    chain.recordSuccess('p1');
    const list = chain.list();
    expect(list[0]!.status).toBe('active');
  });

  it('recover로 down -> active 복구한다', () => {
    chain.addProvider(createProvider({ id: 'p1', status: 'down', consecutiveErrors: 5 }));
    chain.recover('p1');
    const list = chain.list();
    expect(list[0]!.status).toBe('active');
    expect(list[0]!.consecutiveErrors).toBe(0);
  });

  it('active 상태에서 recover는 무동작', () => {
    chain.addProvider(createProvider({ id: 'p1' }));
    chain.recover('p1');
    expect(chain.list()[0]!.status).toBe('active');
  });
});

// ── CostTracker — Design §5 ────────────────────────────────────────────

describe('CostTracker 비용 추적 (FR-ADV27.5)', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
    tracker.setPricing({
      provider: 'local',
      model: 'model-a',
      inputPer1K: 0.01,
      outputPer1K: 0.02,
    });
  });

  it('비용을 계산한다', () => {
    const cost = tracker.calculateCost('local', 'model-a', 1000, 500);
    expect(cost).toBeCloseTo(0.01 * 1 + 0.02 * 0.5); // 0.02
  });

  it('미등록 모델은 비용 0', () => {
    expect(tracker.calculateCost('unknown', 'unknown', 1000, 500)).toBe(0);
  });

  it('사용량을 기록하고 비용을 반환한다', () => {
    const cost = tracker.record('tenant-1', 'local', 'model-a', 1000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(tracker.size).toBe(1);
  });

  it('테넌트별 사용량 요약을 반환한다', () => {
    tracker.record('tenant-1', 'local', 'model-a', 1000, 500);
    tracker.record('tenant-1', 'local', 'model-a', 2000, 1000);

    const summary = tracker.getSummary('tenant-1');
    expect(summary.requestCount).toBe(2);
    expect(summary.totalTokens).toBe(4500); // (1000+500)+(2000+1000)
    expect(summary.totalCost).toBeGreaterThan(0);
    expect(summary.providerBreakdown['local']).toBeDefined();
    expect(summary.providerBreakdown['local']!.requests).toBe(2);
  });

  it('빈 테넌트 요약은 0', () => {
    const summary = tracker.getSummary('nonexistent');
    expect(summary.requestCount).toBe(0);
    expect(summary.totalCost).toBe(0);
  });

  it('기간 필터링이 적용된다', () => {
    tracker.record('tenant-1', 'local', 'model-a', 1000, 500);
    // 현재 날짜 접두사로 필터
    const today = new Date().toISOString().slice(0, 10);
    const summary = tracker.getSummary('tenant-1', today);
    expect(summary.requestCount).toBe(1);
  });

  it('테넌트 격리를 유지한다', () => {
    tracker.record('tenant-1', 'local', 'model-a', 1000, 500);
    tracker.record('tenant-2', 'local', 'model-a', 2000, 1000);

    const s1 = tracker.getSummary('tenant-1');
    const s2 = tracker.getSummary('tenant-2');
    expect(s1.requestCount).toBe(1);
    expect(s2.requestCount).toBe(1);
  });
});

// ── calculateRoutingScore — Design §4 ────────────────────────────────────

describe('calculateRoutingScore 라우팅 점수 (FR-ADV27.4)', () => {
  it('점수를 계산한다', () => {
    const provider = createProvider();
    const score = calculateRoutingScore(provider, 0.5, 0.3, 0.9);
    expect(score.providerId).toBe('provider-1');
    expect(score.costScore).toBeCloseTo(0.5, 2);  // 1 - 0.5
    expect(score.latencyScore).toBeCloseTo(0.7, 2); // 1 - 0.3
    expect(score.qualityScore).toBeCloseTo(0.9, 2);
    // total = 0.5*0.3 + 0.7*0.3 + 0.9*0.4 = 0.15+0.21+0.36 = 0.72
    expect(score.totalScore).toBeCloseTo(0.72, 2);
  });

  it('최저 비용/지연은 최고 점수', () => {
    const provider = createProvider();
    const score = calculateRoutingScore(provider, 0, 0, 1.0);
    expect(score.totalScore).toBeCloseTo(1.0, 2);
  });

  it('최고 비용/지연은 최저 점수', () => {
    const provider = createProvider();
    const score = calculateRoutingScore(provider, 1, 1, 0);
    expect(score.totalScore).toBeCloseTo(0, 2);
  });
});

// ── selectBestProvider — Design §4 ──────────────────────────────────────

describe('selectBestProvider 최적 제공자 선택', () => {
  it('최고 점수 제공자를 선택한다', () => {
    const providers = [
      createProvider({ id: 'p1' }),
      createProvider({ id: 'p2' }),
    ];

    const result = selectBestProvider(providers, (p) => ({
      providerId: p.id,
      costScore: p.id === 'p1' ? 0.5 : 0.9,
      latencyScore: 0.5,
      qualityScore: 0.5,
      totalScore: p.id === 'p1' ? 0.5 : 0.9,
    }));

    expect(result).toBeDefined();
    expect(result!.provider.id).toBe('p2');
  });

  it('비활성 제공자를 건너뛴다', () => {
    const providers = [
      createProvider({ id: 'p1', status: 'down' }),
      createProvider({ id: 'p2' }),
    ];

    const result = selectBestProvider(providers, (p) => ({
      providerId: p.id,
      costScore: 1, latencyScore: 1, qualityScore: 1, totalScore: 1,
    }));

    expect(result!.provider.id).toBe('p2');
  });

  it('부하 초과 제공자를 건너뛴다', () => {
    const providers = [
      createProvider({ id: 'p1', currentLoad: 10, maxConcurrency: 10 }),
      createProvider({ id: 'p2' }),
    ];

    const result = selectBestProvider(providers, (p) => ({
      providerId: p.id,
      costScore: 1, latencyScore: 1, qualityScore: 1, totalScore: 1,
    }));

    expect(result!.provider.id).toBe('p2');
  });

  it('사용 가능한 제공자가 없으면 undefined', () => {
    const providers = [
      createProvider({ status: 'down' }),
    ];

    const result = selectBestProvider(providers, () => ({
      providerId: '', costScore: 1, latencyScore: 1, qualityScore: 1, totalScore: 1,
    }));

    expect(result).toBeUndefined();
  });
});
