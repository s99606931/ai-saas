// SVC-AI-ADV-R18 단위 테스트: 프롬프트 A/B 테스트 & 카나리 배포
// Design Ref: SVC-AI-ADV-R18 DESIGN §1~§6
// Plan SC: FR-ADV18.1~18.6
// CSAP: D-12 변경 관리, D-06 감사 로깅

import { describe, it, expect, beforeEach } from 'vitest';

import {
  assignVariant,
  ExperimentMetricStore,
  zTest,
  ExperimentManager,
} from '../../src/lib/prompt-ab-testing.js';
import type {
  Experiment,
  PromptVariant,
  VariantStats,
} from '../../src/lib/prompt-ab-testing.js';

// ── 테스트 헬퍼 ────────────────────────────────────────────────────────────

function createExperiment(overrides: Partial<Experiment> = {}): Experiment {
  return {
    id: 'exp-test-1',
    name: '테스트 실험',
    description: '프롬프트 A/B 테스트',
    control: {
      id: 'control',
      name: 'Control',
      promptTemplate: '기본 프롬프트',
      trafficPercent: 70,
    },
    variants: [{
      id: 'variant-a',
      name: 'Variant A',
      promptTemplate: '변형 프롬프트',
      trafficPercent: 30,
    }],
    status: 'running',
    minSampleSize: 100,
    confidenceLevel: 0.95,
    metadata: {},
    ...overrides,
  };
}

// ── assignVariant 트래픽 분배 — Design §2 ──────────────────────────────────

describe('assignVariant 트래픽 분배 (FR-ADV18.2)', () => {
  it('동일 사용자에게 동일 variant를 할당한다 (결정론적)', () => {
    const exp = createExperiment();
    const v1 = assignVariant('user-123', exp);
    const v2 = assignVariant('user-123', exp);
    expect(v1.id).toBe(v2.id);
  });

  it('다른 사용자에게 다른 variant를 할당할 수 있다', () => {
    const exp = createExperiment();
    const variants = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const v = assignVariant(`user-${i}`, exp);
      variants.add(v.id);
    }
    // 100명 중 적어도 2가지 variant가 나와야 함
    expect(variants.size).toBeGreaterThanOrEqual(2);
  });

  it('트래픽 비율에 근사하게 분배한다', () => {
    const exp = createExperiment();
    let controlCount = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      const v = assignVariant(`test-user-${i}`, exp);
      if (v.id === 'control') controlCount++;
    }
    // 70% 목표 ± 10% 허용
    expect(controlCount / total).toBeGreaterThan(0.55);
    expect(controlCount / total).toBeLessThan(0.85);
  });

  it('실험 ID가 다르면 분배가 달라진다', () => {
    const exp1 = createExperiment({ id: 'exp-1' });
    const exp2 = createExperiment({ id: 'exp-2' });
    // 1000명 중 적어도 1명은 다른 결과를 받아야
    let diffCount = 0;
    for (let i = 0; i < 100; i++) {
      const v1 = assignVariant(`user-${i}`, exp1);
      const v2 = assignVariant(`user-${i}`, exp2);
      if (v1.id !== v2.id) diffCount++;
    }
    expect(diffCount).toBeGreaterThan(0);
  });
});

// ── ExperimentMetricStore — Design §3 ──────────────────────────────────────

describe('ExperimentMetricStore 메트릭 수집 (FR-ADV18.3)', () => {
  let store: ExperimentMetricStore;

  beforeEach(() => {
    store = new ExperimentMetricStore();
  });

  it('메트릭을 기록한다', () => {
    store.record({
      experimentId: 'exp-1',
      variantId: 'control',
      userId: 'user-1',
      qualityScore: 0.85,
      latencyMs: 200,
      tokensUsed: 500,
      userFeedback: 'positive',
      timestamp: new Date().toISOString(),
    });
    expect(store.size).toBe(1);
  });

  it('변형별 통계를 집계한다', () => {
    for (let i = 0; i < 5; i++) {
      store.record({
        experimentId: 'exp-1',
        variantId: 'control',
        userId: `user-${i}`,
        qualityScore: 0.8 + i * 0.02,
        latencyMs: 150 + i * 10,
        tokensUsed: 400 + i * 50,
        userFeedback: i < 3 ? 'positive' : 'negative',
        timestamp: new Date().toISOString(),
      });
    }

    const stats = store.getStats('exp-1', 'control');
    expect(stats.sampleSize).toBe(5);
    expect(stats.avgQualityScore).toBeGreaterThan(0.8);
    expect(stats.avgLatencyMs).toBeGreaterThan(0);
    expect(stats.positiveRate).toBe(0.6); // 3/5
    expect(stats.negativeRate).toBe(0.4); // 2/5
  });

  it('없는 variant는 빈 통계를 반환한다', () => {
    const stats = store.getStats('exp-1', 'nonexistent');
    expect(stats.sampleSize).toBe(0);
    expect(stats.avgQualityScore).toBe(0);
    expect(stats.positiveRate).toBe(0);
  });

  it('실험별 샘플 수를 반환한다', () => {
    for (let i = 0; i < 3; i++) {
      store.record({
        experimentId: 'exp-1',
        variantId: 'control',
        userId: `user-${i}`,
        qualityScore: 0.8,
        latencyMs: 100,
        tokensUsed: 300,
        timestamp: new Date().toISOString(),
      });
    }
    expect(store.sampleCount('exp-1')).toBe(3);
    expect(store.sampleCount('exp-2')).toBe(0);
  });
});

// ── zTest 통계 분석 — Design §4 ────────────────────────────────────────────

describe('zTest 통계 분석 (FR-ADV18.4)', () => {
  it('표본 크기 부족 시 inconclusive를 반환한다', () => {
    const control: VariantStats = {
      variantId: 'control', sampleSize: 20,
      avgQualityScore: 0.8, avgLatencyMs: 100, avgTokensUsed: 300,
      positiveRate: 0.7, negativeRate: 0.3,
    };
    const variant: VariantStats = {
      variantId: 'variant', sampleSize: 25,
      avgQualityScore: 0.85, avgLatencyMs: 110, avgTokensUsed: 320,
      positiveRate: 0.8, negativeRate: 0.2,
    };

    const result = zTest(control, variant);
    expect(result.verdict).toBe('inconclusive');
    expect(result.significant).toBe(false);
  });

  it('유의미한 차이가 있으면 variant_wins를 반환한다', () => {
    const control: VariantStats = {
      variantId: 'control', sampleSize: 200,
      avgQualityScore: 0.6, avgLatencyMs: 100, avgTokensUsed: 300,
      positiveRate: 0.4, negativeRate: 0.6,
    };
    const variant: VariantStats = {
      variantId: 'variant', sampleSize: 200,
      avgQualityScore: 0.85, avgLatencyMs: 110, avgTokensUsed: 320,
      positiveRate: 0.8, negativeRate: 0.2,
    };

    const result = zTest(control, variant);
    expect(result.significant).toBe(true);
    expect(result.verdict).toBe('variant_wins');
    expect(result.pValue).toBeLessThan(0.05);
  });

  it('control이 더 좋으면 control_wins를 반환한다', () => {
    const control: VariantStats = {
      variantId: 'control', sampleSize: 200,
      avgQualityScore: 0.9, avgLatencyMs: 100, avgTokensUsed: 300,
      positiveRate: 0.85, negativeRate: 0.15,
    };
    const variant: VariantStats = {
      variantId: 'variant', sampleSize: 200,
      avgQualityScore: 0.5, avgLatencyMs: 200, avgTokensUsed: 500,
      positiveRate: 0.35, negativeRate: 0.65,
    };

    const result = zTest(control, variant);
    expect(result.significant).toBe(true);
    expect(result.verdict).toBe('control_wins');
  });

  it('차이가 없으면 inconclusive를 반환한다', () => {
    const control: VariantStats = {
      variantId: 'control', sampleSize: 50,
      avgQualityScore: 0.8, avgLatencyMs: 100, avgTokensUsed: 300,
      positiveRate: 0.5, negativeRate: 0.5,
    };
    const variant: VariantStats = {
      variantId: 'variant', sampleSize: 50,
      avgQualityScore: 0.8, avgLatencyMs: 100, avgTokensUsed: 300,
      positiveRate: 0.5, negativeRate: 0.5,
    };

    const result = zTest(control, variant);
    expect(result.verdict).toBe('inconclusive');
  });

  it('신뢰구간을 계산한다', () => {
    const control: VariantStats = {
      variantId: 'control', sampleSize: 100,
      avgQualityScore: 0.8, avgLatencyMs: 100, avgTokensUsed: 300,
      positiveRate: 0.6, negativeRate: 0.4,
    };
    const variant: VariantStats = {
      variantId: 'variant', sampleSize: 100,
      avgQualityScore: 0.85, avgLatencyMs: 110, avgTokensUsed: 320,
      positiveRate: 0.7, negativeRate: 0.3,
    };

    const result = zTest(control, variant);
    expect(result.confidenceInterval.lower).toBeDefined();
    expect(result.confidenceInterval.upper).toBeDefined();
    expect(result.confidenceInterval.upper).toBeGreaterThan(result.confidenceInterval.lower);
  });
});

// ── ExperimentManager — Design §5,§6 ──────────────────────────────────────

describe('ExperimentManager 실험 관리 (FR-ADV18.5)', () => {
  let manager: ExperimentManager;

  beforeEach(() => {
    manager = new ExperimentManager();
  });

  it('실험을 생성한다', () => {
    const exp = manager.createExperiment({
      name: '프롬프트 v2 테스트',
      description: '새 프롬프트 효과 검증',
      controlPrompt: '기본 프롬프트',
      variantPrompt: '개선 프롬프트',
      trafficSplit: 30,
    });

    expect(exp.id).toMatch(/^exp-/);
    expect(exp.status).toBe('draft');
    expect(exp.control.trafficPercent).toBe(70);
    expect(exp.variants[0]!.trafficPercent).toBe(30);
  });

  it('실험을 시작한다', () => {
    const exp = manager.createExperiment({
      name: '실험', description: '', controlPrompt: 'a', variantPrompt: 'b', trafficSplit: 50,
    });
    const started = manager.start(exp.id);
    expect(started).toBeDefined();
    expect(started!.status).toBe('running');
    expect(started!.startedAt).toBeDefined();
  });

  it('draft가 아닌 실험은 시작할 수 없다', () => {
    const exp = manager.createExperiment({
      name: '실험', description: '', controlPrompt: 'a', variantPrompt: 'b', trafficSplit: 50,
    });
    manager.start(exp.id);
    const result = manager.start(exp.id); // 이미 running
    expect(result).toBeUndefined();
  });

  it('running 실험에만 variant를 할당한다', () => {
    const exp = manager.createExperiment({
      name: '실험', description: '', controlPrompt: 'a', variantPrompt: 'b', trafficSplit: 50,
    });
    // draft 상태에서는 할당 불가
    expect(manager.assign(exp.id, 'user-1')).toBeUndefined();

    manager.start(exp.id);
    const variant = manager.assign(exp.id, 'user-1');
    expect(variant).toBeDefined();
  });

  it('실험을 종료한다', () => {
    const exp = manager.createExperiment({
      name: '실험', description: '', controlPrompt: 'a', variantPrompt: 'b', trafficSplit: 50,
    });
    manager.start(exp.id);
    const concluded = manager.conclude(exp.id, 'variant_wins');
    expect(concluded).toBeDefined();
    expect(concluded!.status).toBe('concluded');
    expect(concluded!.verdict).toBe('variant_wins');
  });

  it('실험 목록을 반환한다', () => {
    manager.createExperiment({
      name: '실험1', description: '', controlPrompt: 'a', variantPrompt: 'b', trafficSplit: 50,
    });
    manager.createExperiment({
      name: '실험2', description: '', controlPrompt: 'a', variantPrompt: 'b', trafficSplit: 50,
    });
    expect(manager.list()).toHaveLength(2);
  });

  it('최소 표본 미달 시 inconclusive를 반환한다', () => {
    const exp = manager.createExperiment({
      name: '실험', description: '', controlPrompt: 'a', variantPrompt: 'b',
      trafficSplit: 50, minSampleSize: 100,
    });
    manager.start(exp.id);

    // 소수 메트릭만 기록
    manager.recordMetric({
      experimentId: exp.id, variantId: 'control', userId: 'user-1',
      qualityScore: 0.8, latencyMs: 100, tokensUsed: 300, timestamp: new Date().toISOString(),
    });

    const result = manager.analyze(exp.id);
    expect(result).toBeDefined();
    expect(result!.verdict).toBe('inconclusive');
  });
});
