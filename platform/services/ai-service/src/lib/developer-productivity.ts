// 개발자 생산성 메트릭 대시보드 -- FR-N264.1~FR-N264.6
// Design Ref: MTU-N264 DESIGN §1~§6
// Plan SC: SPACE 5차원, 팀 레벨, 트렌드, 병목, AI 제안, 벤치마크
// CSAP: D-07 모니터링, D-08 접근 통제 (팀 레벨만), D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** SPACE 차원 -- Design §1 */
export type SpaceDimension =
  | 'satisfaction'  // S: 만족도/웰빙
  | 'performance'   // P: 성과
  | 'activity'      // A: 활동
  | 'communication' // C: 소통/협업
  | 'efficiency';   // E: 효율/흐름

/** DORA 성능 등급 */
export type DoraPerformanceLevel = 'elite' | 'high' | 'medium' | 'low';

/** SPACE 메트릭 데이터 포인트 */
export interface SpaceMetricPoint {
  dimension: SpaceDimension;
  metric: string;
  value: number;
  unit: string;
  period: string;     // YYYY-MM-DD
  teamId: string;
}

/** 팀 생산성 스냅샷 -- Design §2 */
export interface TeamProductivitySnapshot {
  teamId: string;
  teamName: string;
  period: string;
  space: Record<SpaceDimension, number>;    // 0~100 점수
  overallScore: number;
  doraMetrics: {
    deploymentFrequency: number;            // 배포/일
    leadTime: number;                        // 시간
    changeFailureRate: number;               // %
    mttr: number;                            // 분
  };
  doraLevel: DoraPerformanceLevel;
  bottlenecks: Bottleneck[];
  suggestions: ProductivitySuggestion[];
}

/** 병목 지점 -- Design §4 */
export interface Bottleneck {
  id: string;
  stage: string;
  metric: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  currentValue: number;
  targetValue: number;
  gap: number;
  description: string;
}

/** 개선 제안 -- Design §5 */
export interface ProductivitySuggestion {
  id: string;
  category: SpaceDimension;
  title: string;
  description: string;
  expectedImpact: string;
  priority: number;
  relatedBottleneck?: string;
}

/** 트렌드 데이터 -- Design §3 */
export interface TrendData {
  metric: string;
  points: Array<{ period: string; value: number }>;
  movingAverage: number;
  changeFromPrevious: number;
  changePercent: number;
  trend: 'improving' | 'stable' | 'declining';
}

/** 벤치마크 비교 -- Design §6 */
export interface BenchmarkComparison {
  metric: string;
  teamValue: number;
  eliteBenchmark: number;
  highBenchmark: number;
  mediumBenchmark: number;
  lowBenchmark: number;
  currentLevel: DoraPerformanceLevel;
  gapToNext: number;
}

// -- SPACE 메트릭 수집기 -- Design §1 ────────────────────────────────────────

/** SPACE 메트릭 수집 및 관리 */
export class SpaceMetricsCollector {
  private dataPoints: SpaceMetricPoint[] = [];

  /** 메트릭 기록 */
  record(point: SpaceMetricPoint): void {
    this.dataPoints.push(point);
    // 최근 365일 유지
    const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0] ?? '';
    this.dataPoints = this.dataPoints.filter((p) => p.period >= cutoff);
  }

  /** 배치 기록 */
  recordBatch(points: SpaceMetricPoint[]): void {
    for (const point of points) {
      this.record(point);
    }
  }

  /** 차원별 점수 계산 (기간 내 평균) */
  getDimensionScore(teamId: string, dimension: SpaceDimension, days: number): number {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0] ?? '';
    const relevantPoints = this.dataPoints.filter(
      (p) => p.teamId === teamId && p.dimension === dimension && p.period >= cutoff,
    );

    if (relevantPoints.length === 0) return 50; // 기본값

    const sum = relevantPoints.reduce((acc, p) => acc + p.value, 0);
    return Math.round((sum / relevantPoints.length) * 100) / 100;
  }

  /** 트렌드 계산 -- Design §3 */
  getTrend(teamId: string, metric: string, days: number): TrendData {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0] ?? '';
    const points = this.dataPoints
      .filter((p) => p.teamId === teamId && p.metric === metric && p.period >= cutoff)
      .sort((a, b) => a.period.localeCompare(b.period));

    const values = points.map((p) => ({ period: p.period, value: p.value }));
    const recentValues = values.slice(-7).map((v) => v.value);
    const previousValues = values.slice(-14, -7).map((v) => v.value);

    const recentAvg = recentValues.length > 0
      ? recentValues.reduce((a, b) => a + b, 0) / recentValues.length : 0;
    const previousAvg = previousValues.length > 0
      ? previousValues.reduce((a, b) => a + b, 0) / previousValues.length : 0;

    const change = recentAvg - previousAvg;
    const changePercent = previousAvg !== 0
      ? Math.round((change / previousAvg) * 10000) / 100 : 0;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (changePercent > 5) trend = 'improving';
    if (changePercent < -5) trend = 'declining';

    return {
      metric,
      points: values,
      movingAverage: Math.round(recentAvg * 100) / 100,
      changeFromPrevious: Math.round(change * 100) / 100,
      changePercent,
      trend,
    };
  }

  /** 팀 목록 */
  getTeamIds(): string[] {
    return [...new Set(this.dataPoints.map((p) => p.teamId))];
  }
}

// -- 병목 감지 -- Design §4 ──────────────────────────────────────────────────

/** 병목 감지 엔진 */
export class BottleneckDetector {
  private readonly targets = {
    deploymentFrequency: { target: 1, unit: '회/일', stage: '배포' },
    leadTime: { target: 24, unit: '시간', stage: '리드 타임' },
    changeFailureRate: { target: 15, unit: '%', stage: '변경 실패' },
    mttr: { target: 60, unit: '분', stage: '복구 시간' },
    prReviewTime: { target: 4, unit: '시간', stage: 'PR 리뷰' },
    buildTime: { target: 10, unit: '분', stage: '빌드' },
    testCoverage: { target: 80, unit: '%', stage: '테스트' },
  };

  /** 병목 감지 */
  detect(metrics: Record<string, number>): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    for (const [metric, config] of Object.entries(this.targets)) {
      const currentValue = metrics[metric];
      if (currentValue === undefined) continue;

      // 리드 타임, 실패율, MTTR 등은 낮을수록 좋음
      const isLowerBetter = ['leadTime', 'changeFailureRate', 'mttr', 'prReviewTime', 'buildTime'].includes(metric);
      const isBottleneck = isLowerBetter
        ? currentValue > config.target
        : currentValue < config.target;

      if (isBottleneck) {
        const gap = isLowerBetter
          ? currentValue - config.target
          : config.target - currentValue;

        const severity = gap > config.target * 0.5 ? 'critical'
          : gap > config.target * 0.3 ? 'high'
          : gap > config.target * 0.1 ? 'medium' : 'low';

        bottlenecks.push({
          id: randomUUID(),
          stage: config.stage,
          metric,
          severity,
          currentValue,
          targetValue: config.target,
          gap: Math.round(gap * 100) / 100,
          description: `${config.stage}: 현재 ${currentValue}${config.unit}, 목표 ${config.target}${config.unit}`,
        });
      }
    }

    return bottlenecks.sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
    });
  }
}

// -- AI 개선 제안 -- Design §5 ──────────────────────────────────────────────

/** 병목 패턴별 개선 제안 생성 */
export function generateProductivitySuggestions(
  bottlenecks: Bottleneck[],
  spaceScores: Record<SpaceDimension, number>,
): ProductivitySuggestion[] {
  const suggestions: ProductivitySuggestion[] = [];

  for (const bottleneck of bottlenecks) {
    switch (bottleneck.metric) {
      case 'leadTime':
        suggestions.push({
          id: randomUUID(),
          category: 'efficiency',
          title: '리드 타임 단축',
          description: 'PR 크기 축소, 자동 테스트 강화, 코드 리뷰 SLA 설정을 권장합니다',
          expectedImpact: `리드 타임 ${bottleneck.gap}시간 단축 예상`,
          priority: 1,
          relatedBottleneck: bottleneck.id,
        });
        break;
      case 'changeFailureRate':
        suggestions.push({
          id: randomUUID(),
          category: 'performance',
          title: '변경 실패율 감소',
          description: 'Feature Flag 도입, 카나리 배포 확대, 테스트 커버리지 향상을 권장합니다',
          expectedImpact: `실패율 ${bottleneck.gap}% 감소 예상`,
          priority: 1,
          relatedBottleneck: bottleneck.id,
        });
        break;
      case 'mttr':
        suggestions.push({
          id: randomUUID(),
          category: 'efficiency',
          title: 'MTTR 단축',
          description: '런북 자동화, AIOps RCA 활용, 온콜 프로세스 개선을 권장합니다',
          expectedImpact: `MTTR ${bottleneck.gap}분 단축 예상`,
          priority: 2,
          relatedBottleneck: bottleneck.id,
        });
        break;
      case 'deploymentFrequency':
        suggestions.push({
          id: randomUUID(),
          category: 'activity',
          title: '배포 빈도 향상',
          description: 'CI/CD 파이프라인 최적화, 배포 자동화 확대, 배치 크기 축소를 권장합니다',
          expectedImpact: `배포 빈도 ${bottleneck.gap}회/일 증가 예상`,
          priority: 2,
          relatedBottleneck: bottleneck.id,
        });
        break;
    }
  }

  // SPACE 저점 차원 제안
  const lowestDimension = Object.entries(spaceScores)
    .sort(([, a], [, b]) => a - b)[0];

  if (lowestDimension && lowestDimension[1] < 50) {
    const dimensionLabels: Record<SpaceDimension, string> = {
      satisfaction: '만족도/웰빙',
      performance: '성과',
      activity: '활동',
      communication: '소통/협업',
      efficiency: '효율/흐름',
    };

    suggestions.push({
      id: randomUUID(),
      category: lowestDimension[0] as SpaceDimension,
      title: `${dimensionLabels[lowestDimension[0] as SpaceDimension]} 개선`,
      description: `현재 ${lowestDimension[1]}점으로 가장 낮은 차원입니다. 팀 회고를 통해 원인을 파악하세요.`,
      expectedImpact: '전체 생산성 점수 향상',
      priority: 3,
    });
  }

  return suggestions.sort((a, b) => a.priority - b.priority);
}

// -- 벤치마크 -- Design §6 ──────────────────────────────────────────────────

/** DORA 벤치마크 비교 */
export function compareBenchmark(metrics: {
  deploymentFrequency: number;
  leadTime: number;
  changeFailureRate: number;
  mttr: number;
}): BenchmarkComparison[] {
  const benchmarks = [
    {
      metric: 'deploymentFrequency',
      elite: 1, high: 0.14, medium: 0.03, low: 0.007,
      value: metrics.deploymentFrequency,
      higherBetter: true,
    },
    {
      metric: 'leadTime',
      elite: 24, high: 168, medium: 720, low: 4320,
      value: metrics.leadTime,
      higherBetter: false,
    },
    {
      metric: 'changeFailureRate',
      elite: 5, high: 10, medium: 15, low: 64,
      value: metrics.changeFailureRate,
      higherBetter: false,
    },
    {
      metric: 'mttr',
      elite: 60, high: 1440, medium: 10080, low: 43200,
      value: metrics.mttr,
      higherBetter: false,
    },
  ];

  return benchmarks.map((b) => {
    let level: DoraPerformanceLevel;
    let gapToNext: number;

    if (b.higherBetter) {
      if (b.value >= b.elite) { level = 'elite'; gapToNext = 0; }
      else if (b.value >= b.high) { level = 'high'; gapToNext = b.elite - b.value; }
      else if (b.value >= b.medium) { level = 'medium'; gapToNext = b.high - b.value; }
      else { level = 'low'; gapToNext = b.medium - b.value; }
    } else {
      if (b.value <= b.elite) { level = 'elite'; gapToNext = 0; }
      else if (b.value <= b.high) { level = 'high'; gapToNext = b.value - b.elite; }
      else if (b.value <= b.medium) { level = 'medium'; gapToNext = b.value - b.high; }
      else { level = 'low'; gapToNext = b.value - b.medium; }
    }

    return {
      metric: b.metric,
      teamValue: b.value,
      eliteBenchmark: b.elite,
      highBenchmark: b.high,
      mediumBenchmark: b.medium,
      lowBenchmark: b.low,
      currentLevel: level,
      gapToNext: Math.round(gapToNext * 100) / 100,
    };
  });
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

/** 개발자 생산성 메트릭 엔진 생성 */
export function createProductivityEngine(): {
  collector: SpaceMetricsCollector;
  bottleneckDetector: BottleneckDetector;
} {
  return {
    collector: new SpaceMetricsCollector(),
    bottleneckDetector: new BottleneckDetector(),
  };
}
