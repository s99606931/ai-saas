// MTU-N264 단위 테스트: 개발자 생산성 메트릭 대시보드
// Design Ref: MTU-N264 DESIGN §1~§6
// CSAP: D-07 모니터링, D-08 접근 통제, D-12 개발 보안

import { describe, it, expect, beforeEach } from 'vitest';

import {
  SpaceMetricsCollector,
  BottleneckDetector,
  createProductivityEngine,
  generateProductivitySuggestions,
  compareBenchmark,
  type SpaceMetricPoint,
  type Bottleneck,
  type SpaceDimension,
} from '../../src/lib/developer-productivity.js';

// -- 헬퍼 ──────────────────────────────────────────────────────────────────

function makePoint(overrides: Partial<SpaceMetricPoint> = {}): SpaceMetricPoint {
  return {
    dimension: 'activity',
    metric: 'commits',
    value: 75,
    unit: '건',
    period: '2026-04-01',
    teamId: 'team-A',
    ...overrides,
  };
}

// -- SpaceMetricsCollector -- Design §1 ────────────────────────────────────

describe('SpaceMetricsCollector (FR-N264.1)', () => {
  let collector: SpaceMetricsCollector;

  beforeEach(() => {
    collector = new SpaceMetricsCollector();
  });

  it('메트릭을 기록한다', () => {
    collector.record(makePoint());
    expect(collector.getTeamIds()).toContain('team-A');
  });

  it('배치 기록을 지원한다', () => {
    collector.recordBatch([
      makePoint({ teamId: 'team-A' }),
      makePoint({ teamId: 'team-B' }),
    ]);
    expect(collector.getTeamIds()).toHaveLength(2);
  });

  it('차원별 점수를 계산한다', () => {
    collector.record(makePoint({ dimension: 'activity', value: 80 }));
    collector.record(makePoint({ dimension: 'activity', value: 60 }));
    const score = collector.getDimensionScore('team-A', 'activity', 30);
    expect(score).toBe(70); // (80+60)/2
  });

  it('데이터 없으면 기본값 50', () => {
    expect(collector.getDimensionScore('team-A', 'satisfaction', 30)).toBe(50);
  });

  it('트렌드를 계산한다 (stable)', () => {
    // 14일간 동일한 값
    for (let i = 1; i <= 14; i++) {
      collector.record(makePoint({
        metric: 'commits',
        value: 10,
        period: `2026-04-${String(i).padStart(2, '0')}`,
      }));
    }
    const trend = collector.getTrend('team-A', 'commits', 30);
    expect(trend.trend).toBe('stable');
    expect(trend.metric).toBe('commits');
    expect(trend.points.length).toBeGreaterThan(0);
  });

  it('트렌드를 계산한다 (improving)', () => {
    // 이전 7일: 낮은 값, 최근 7일: 높은 값
    for (let i = 1; i <= 7; i++) {
      collector.record(makePoint({
        metric: 'deploys',
        value: 5,
        period: `2026-04-${String(i).padStart(2, '0')}`,
      }));
    }
    for (let i = 8; i <= 14; i++) {
      collector.record(makePoint({
        metric: 'deploys',
        value: 50,
        period: `2026-04-${String(i).padStart(2, '0')}`,
      }));
    }
    const trend = collector.getTrend('team-A', 'deploys', 30);
    expect(trend.trend).toBe('improving');
    expect(trend.changePercent).toBeGreaterThan(5);
  });

  it('데이터 없는 트렌드', () => {
    const trend = collector.getTrend('team-X', 'missing', 30);
    expect(trend.points).toHaveLength(0);
    expect(trend.trend).toBe('stable');
  });
});

// -- BottleneckDetector -- Design §4 ──────────────────────────────────────

describe('BottleneckDetector (FR-N264.4)', () => {
  let detector: BottleneckDetector;

  beforeEach(() => {
    detector = new BottleneckDetector();
  });

  it('리드 타임 병목을 감지한다 (높을수록 나쁨)', () => {
    const bottlenecks = detector.detect({ leadTime: 100 }); // 목표 24시간
    expect(bottlenecks.some((b) => b.metric === 'leadTime')).toBe(true);
  });

  it('배포 빈도 병목을 감지한다 (낮을수록 나쁨)', () => {
    const bottlenecks = detector.detect({ deploymentFrequency: 0.1 }); // 목표 1회/일
    expect(bottlenecks.some((b) => b.metric === 'deploymentFrequency')).toBe(true);
  });

  it('테스트 커버리지 병목을 감지한다', () => {
    const bottlenecks = detector.detect({ testCoverage: 40 }); // 목표 80%
    expect(bottlenecks.some((b) => b.metric === 'testCoverage')).toBe(true);
  });

  it('MTTR 병목을 감지한다', () => {
    const bottlenecks = detector.detect({ mttr: 180 }); // 목표 60분
    expect(bottlenecks.some((b) => b.metric === 'mttr')).toBe(true);
  });

  it('정상 메트릭이면 병목 없음', () => {
    const bottlenecks = detector.detect({
      deploymentFrequency: 2,
      leadTime: 12,
      changeFailureRate: 5,
      mttr: 30,
      testCoverage: 90,
    });
    expect(bottlenecks).toHaveLength(0);
  });

  it('심각도 순으로 정렬한다', () => {
    const bottlenecks = detector.detect({
      leadTime: 200,        // critical gap
      mttr: 70,             // low gap
      testCoverage: 60,     // medium gap
    });
    if (bottlenecks.length >= 2) {
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 1; i < bottlenecks.length; i++) {
        expect(severityOrder[bottlenecks[i]!.severity]).toBeGreaterThanOrEqual(
          severityOrder[bottlenecks[i - 1]!.severity],
        );
      }
    }
  });
});

// -- generateProductivitySuggestions -- Design §5 ──────────────────────────

describe('generateProductivitySuggestions (FR-N264.5)', () => {
  it('리드타임 병목에 대한 제안을 생성한다', () => {
    const bottlenecks: Bottleneck[] = [{
      id: 'b1', stage: '리드 타임', metric: 'leadTime',
      severity: 'high', currentValue: 100, targetValue: 24, gap: 76,
      description: '',
    }];
    const suggestions = generateProductivitySuggestions(bottlenecks, {
      satisfaction: 70, performance: 60, activity: 80, communication: 75, efficiency: 65,
    });
    expect(suggestions.some((s) => s.title === '리드 타임 단축')).toBe(true);
  });

  it('변경실패율 병목에 대한 제안', () => {
    const bottlenecks: Bottleneck[] = [{
      id: 'b2', stage: '변경 실패', metric: 'changeFailureRate',
      severity: 'high', currentValue: 30, targetValue: 15, gap: 15,
      description: '',
    }];
    const suggestions = generateProductivitySuggestions(bottlenecks, {
      satisfaction: 70, performance: 60, activity: 80, communication: 75, efficiency: 65,
    });
    expect(suggestions.some((s) => s.title === '변경 실패율 감소')).toBe(true);
  });

  it('SPACE 저점 차원에 대한 제안', () => {
    const suggestions = generateProductivitySuggestions([], {
      satisfaction: 30, performance: 60, activity: 80, communication: 75, efficiency: 65,
    });
    expect(suggestions.some((s) => s.category === 'satisfaction')).toBe(true);
  });

  it('모든 점수가 50 이상이면 SPACE 제안 없음', () => {
    const suggestions = generateProductivitySuggestions([], {
      satisfaction: 70, performance: 60, activity: 80, communication: 75, efficiency: 65,
    });
    expect(suggestions).toHaveLength(0);
  });

  it('우선순위 순으로 정렬한다', () => {
    const bottlenecks: Bottleneck[] = [
      { id: 'b1', stage: 'MTTR', metric: 'mttr', severity: 'medium', currentValue: 120, targetValue: 60, gap: 60, description: '' },
      { id: 'b2', stage: '리드타임', metric: 'leadTime', severity: 'high', currentValue: 100, targetValue: 24, gap: 76, description: '' },
    ];
    const suggestions = generateProductivitySuggestions(bottlenecks, {
      satisfaction: 70, performance: 60, activity: 80, communication: 75, efficiency: 65,
    });
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i]!.priority).toBeGreaterThanOrEqual(suggestions[i - 1]!.priority);
    }
  });
});

// -- compareBenchmark -- Design §6 ──────────────────────────────────────────

describe('compareBenchmark (FR-N264.6)', () => {
  it('elite 수준 메트릭', () => {
    const results = compareBenchmark({
      deploymentFrequency: 3,
      leadTime: 12,
      changeFailureRate: 3,
      mttr: 30,
    });
    for (const result of results) {
      expect(result.currentLevel).toBe('elite');
      expect(result.gapToNext).toBe(0);
    }
  });

  it('low 수준 메트릭', () => {
    const results = compareBenchmark({
      deploymentFrequency: 0.001,
      leadTime: 5000,
      changeFailureRate: 70,
      mttr: 50000,
    });
    for (const result of results) {
      expect(result.currentLevel).toBe('low');
    }
  });

  it('mixed 수준 메트릭', () => {
    const results = compareBenchmark({
      deploymentFrequency: 0.5,    // high (>= 0.14)
      leadTime: 500,               // medium (<= 720)
      changeFailureRate: 8,        // high (<= 10)
      mttr: 1000,                  // high (<= 1440)
    });
    expect(results.find((r) => r.metric === 'deploymentFrequency')!.currentLevel).toBe('high');
    expect(results.find((r) => r.metric === 'leadTime')!.currentLevel).toBe('medium');
    expect(results.find((r) => r.metric === 'changeFailureRate')!.currentLevel).toBe('high');
    expect(results.find((r) => r.metric === 'mttr')!.currentLevel).toBe('high');
  });

  it('gapToNext가 올바르다', () => {
    const results = compareBenchmark({
      deploymentFrequency: 0.5,    // high, gap to elite = 1 - 0.5 = 0.5
      leadTime: 12,                // elite, gap = 0
      changeFailureRate: 3,        // elite, gap = 0
      mttr: 30,                    // elite, gap = 0
    });
    const df = results.find((r) => r.metric === 'deploymentFrequency')!;
    expect(df.gapToNext).toBe(0.5);
  });
});

// -- createProductivityEngine 팩토리 ──────────────────────────────────────

describe('createProductivityEngine 팩토리', () => {
  it('수집기와 병목 감지기를 생성한다', () => {
    const engine = createProductivityEngine();
    expect(engine.collector).toBeInstanceOf(SpaceMetricsCollector);
    expect(engine.bottleneckDetector).toBeInstanceOf(BottleneckDetector);
  });
});
