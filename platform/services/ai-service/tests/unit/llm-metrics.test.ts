// SVC-AI-ADV-R9 단위 테스트: LLM 관찰가능성 메트릭
// Design Ref: SVC-AI-ADV-R9 DESIGN §1
// Plan SC: FR-ADV9.1, FR-ADV9.2, FR-ADV9.3, FR-ADV9.9
// CSAP: D-06, D-12

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LLMMetricsCollector,
  createLLMMetricsCollector,
} from '../../src/lib/llm-metrics.js';
import type { LLMRequestMetric, MetricAlert } from '../../src/lib/llm-metrics.js';

// ── 테스트 헬퍼 ─────────────────────────────────────────────────────────────

function createTestMetric(overrides?: Partial<LLMRequestMetric>): LLMRequestMetric {
  return {
    requestId: `req-${Math.random().toString(36).slice(2, 8)}`,
    model: 'sonnet',
    tenantId: 'tenant-1',
    method: 'chat',
    status: 'success',
    durationMs: 500,
    promptTokens: 100,
    completionTokens: 200,
    cacheHit: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe('LLMMetricsCollector 메트릭 기록 (FR-ADV9.1)', () => {
  let collector: LLMMetricsCollector;

  beforeEach(() => {
    collector = new LLMMetricsCollector({ maxMetrics: 100 });
  });

  it('메트릭을 기록한다', () => {
    collector.record(createTestMetric());
    const agg = collector.aggregate(60_000);
    expect(agg.totalRequests).toBe(1);
  });

  it('성공/에러 카운터를 구분한다', () => {
    collector.record(createTestMetric({ status: 'success' }));
    collector.record(createTestMetric({ status: 'error' }));
    const agg = collector.aggregate(60_000);
    expect(agg.successCount).toBe(1);
    expect(agg.errorCount).toBe(1);
  });

  it('캐시 히트를 추적한다', () => {
    collector.record(createTestMetric({ cacheHit: true }));
    collector.record(createTestMetric({ cacheHit: false }));
    const agg = collector.aggregate(60_000);
    expect(agg.cacheHitCount).toBe(1);
    expect(agg.cacheHitRate).toBe(0.5);
  });

  it('토큰 사용량을 누적한다', () => {
    collector.record(createTestMetric({ promptTokens: 100, completionTokens: 200 }));
    collector.record(createTestMetric({ promptTokens: 150, completionTokens: 300 }));
    const agg = collector.aggregate(60_000);
    expect(agg.totalTokens).toBe(750);
  });

  it('순환 버퍼로 최대 메트릭 수를 제한한다', () => {
    const smallCollector = new LLMMetricsCollector({ maxMetrics: 5 });
    for (let i = 0; i < 10; i++) {
      smallCollector.record(createTestMetric());
    }
    const agg = smallCollector.aggregate(60_000);
    expect(agg.totalRequests).toBeLessThanOrEqual(5);
  });
});

describe('LLMMetricsCollector 집계 (FR-ADV9.2)', () => {
  let collector: LLMMetricsCollector;

  beforeEach(() => {
    collector = new LLMMetricsCollector();
  });

  it('평균 레이턴시를 계산한다', () => {
    collector.record(createTestMetric({ durationMs: 200 }));
    collector.record(createTestMetric({ durationMs: 400 }));
    collector.record(createTestMetric({ durationMs: 600 }));
    const agg = collector.aggregate(60_000);
    expect(agg.avgDurationMs).toBe(400);
  });

  it('P50 레이턴시를 계산한다', () => {
    for (let i = 1; i <= 10; i++) {
      collector.record(createTestMetric({ durationMs: i * 100 }));
    }
    const agg = collector.aggregate(60_000);
    expect(agg.p50DurationMs).toBe(500);
  });

  it('P95 레이턴시를 계산한다', () => {
    for (let i = 1; i <= 100; i++) {
      collector.record(createTestMetric({ durationMs: i * 10 }));
    }
    const agg = collector.aggregate(60_000);
    expect(agg.p95DurationMs).toBeGreaterThanOrEqual(900);
  });

  it('에러율을 계산한다', () => {
    collector.record(createTestMetric({ status: 'success' }));
    collector.record(createTestMetric({ status: 'success' }));
    collector.record(createTestMetric({ status: 'error' }));
    const agg = collector.aggregate(60_000);
    expect(Math.round(agg.errorRate * 100) / 100).toBeCloseTo(0.33, 1);
  });

  it('모델별 분포를 추적한다', () => {
    collector.record(createTestMetric({ model: 'haiku' }));
    collector.record(createTestMetric({ model: 'sonnet' }));
    collector.record(createTestMetric({ model: 'sonnet' }));
    const agg = collector.aggregate(60_000);
    expect(agg.modelDistribution['haiku']).toBe(1);
    expect(agg.modelDistribution['sonnet']).toBe(2);
  });

  it('평균 TTFT를 계산한다', () => {
    collector.record(createTestMetric({ ttftMs: 100, method: 'stream' }));
    collector.record(createTestMetric({ ttftMs: 200, method: 'stream' }));
    const agg = collector.aggregate(60_000);
    expect(agg.avgTtftMs).toBe(150);
  });

  it('빈 윈도우는 빈 집계를 반환한다', () => {
    const agg = collector.aggregate(60_000);
    expect(agg.totalRequests).toBe(0);
    expect(agg.errorRate).toBe(0);
  });

  it('윈도우 밖의 메트릭은 제외한다', () => {
    // 1분 전 메트릭
    collector.record(createTestMetric({ timestamp: Date.now() - 120_000 }));
    // 현재 메트릭
    collector.record(createTestMetric({ timestamp: Date.now() }));
    const agg = collector.aggregate(60_000); // 1분 윈도우
    expect(agg.totalRequests).toBe(1);
  });
});

describe('LLMMetricsCollector 활성 스트림', () => {
  it('활성 스트림 수를 증감한다', () => {
    const collector = new LLMMetricsCollector();
    collector.incrementActiveStreams();
    collector.incrementActiveStreams();
    collector.decrementActiveStreams();
    // Prometheus 출력에서 확인
    const prom = collector.toPrometheus();
    expect(prom).toContain('llm_active_streams 1');
  });

  it('0 미만으로 감소하지 않는다', () => {
    const collector = new LLMMetricsCollector();
    collector.decrementActiveStreams();
    const prom = collector.toPrometheus();
    expect(prom).toContain('llm_active_streams 0');
  });
});

describe('LLMMetricsCollector Prometheus 형식 (FR-ADV9.3)', () => {
  let collector: LLMMetricsCollector;

  beforeEach(() => {
    collector = new LLMMetricsCollector();
    collector.record(createTestMetric({ promptTokens: 100, completionTokens: 200, durationMs: 500 }));
  });

  it('요청 카운터를 포함한다', () => {
    const prom = collector.toPrometheus();
    expect(prom).toContain('llm_request_total 1');
  });

  it('토큰 카운터를 포함한다', () => {
    const prom = collector.toPrometheus();
    expect(prom).toContain('llm_tokens_total{type="prompt"} 100');
    expect(prom).toContain('llm_tokens_total{type="completion"} 200');
  });

  it('레이턴시 히스토그램을 포함한다', () => {
    const prom = collector.toPrometheus();
    expect(prom).toContain('llm_request_duration_ms_bucket');
    expect(prom).toContain('llm_request_duration_ms_sum 500');
    expect(prom).toContain('llm_request_duration_ms_count 1');
  });

  it('TTFT 히스토그램을 포함한다', () => {
    const prom = collector.toPrometheus();
    expect(prom).toContain('llm_ttft_ms_bucket');
  });

  it('활성 스트림 게이지를 포함한다', () => {
    const prom = collector.toPrometheus();
    expect(prom).toContain('llm_active_streams');
  });

  it('HELP/TYPE 주석을 포함한다', () => {
    const prom = collector.toPrometheus();
    expect(prom).toContain('# HELP llm_request_total');
    expect(prom).toContain('# TYPE llm_request_total counter');
  });
});

describe('LLMMetricsCollector 이상 감지 (FR-ADV9.9)', () => {
  it('에러율 초과 시 알림을 발생한다', () => {
    const collector = new LLMMetricsCollector({
      thresholds: { maxErrorRate: 0.1, maxP95LatencyMs: 5000, maxTtftMs: 2000, minSampleCount: 5 },
    });
    const alerts: MetricAlert[] = [];
    collector.onAlert = (alert) => alerts.push(alert);

    // 5개 성공 + 5개 에러 = 50% 에러율
    for (let i = 0; i < 5; i++) {
      collector.record(createTestMetric({ status: 'success' }));
    }
    for (let i = 0; i < 5; i++) {
      collector.record(createTestMetric({ status: 'error' }));
    }

    expect(alerts.some((a) => a.type === 'error_rate')).toBe(true);
  });

  it('P95 레이턴시 초과 시 알림을 발생한다', () => {
    const collector = new LLMMetricsCollector({
      thresholds: { maxErrorRate: 0.1, maxP95LatencyMs: 1000, maxTtftMs: 2000, minSampleCount: 5 },
    });
    const alerts: MetricAlert[] = [];
    collector.onAlert = (alert) => alerts.push(alert);

    for (let i = 0; i < 20; i++) {
      collector.record(createTestMetric({ durationMs: 5000 }));
    }

    expect(alerts.some((a) => a.type === 'latency')).toBe(true);
  });

  it('최소 샘플 수 미달 시 알림을 발생하지 않는다', () => {
    const collector = new LLMMetricsCollector({
      thresholds: { maxErrorRate: 0.1, maxP95LatencyMs: 1000, maxTtftMs: 2000, minSampleCount: 100 },
    });
    const alerts: MetricAlert[] = [];
    collector.onAlert = (alert) => alerts.push(alert);

    for (let i = 0; i < 5; i++) {
      collector.record(createTestMetric({ status: 'error' }));
    }

    expect(alerts).toHaveLength(0);
  });

  it('알림에 severity가 포함된다', () => {
    const collector = new LLMMetricsCollector({
      thresholds: { maxErrorRate: 0.1, maxP95LatencyMs: 5000, maxTtftMs: 2000, minSampleCount: 5 },
    });
    const alerts: MetricAlert[] = [];
    collector.onAlert = (alert) => alerts.push(alert);

    // 매우 높은 에러율 → critical
    for (let i = 0; i < 10; i++) {
      collector.record(createTestMetric({ status: 'error' }));
    }

    const errorAlert = alerts.find((a) => a.type === 'error_rate');
    expect(errorAlert?.severity).toBe('critical');
  });
});

describe('LLMMetricsCollector 초기화', () => {
  it('reset으로 모든 메트릭을 초기화한다', () => {
    const collector = new LLMMetricsCollector();
    collector.record(createTestMetric());
    collector.incrementActiveStreams();
    collector.reset();

    const prom = collector.toPrometheus();
    expect(prom).toContain('llm_request_total 0');
    expect(prom).toContain('llm_active_streams 0');
  });
});

describe('createLLMMetricsCollector 팩토리', () => {
  it('LLMMetricsCollector 인스턴스를 생성한다', () => {
    const collector = createLLMMetricsCollector();
    expect(collector).toBeInstanceOf(LLMMetricsCollector);
  });

  it('커스텀 옵션을 적용한다', () => {
    const collector = createLLMMetricsCollector({ maxMetrics: 50 });
    expect(collector).toBeInstanceOf(LLMMetricsCollector);
  });
});
