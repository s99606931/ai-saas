/**
 * DORA 등급 자동 분류기
 * Design Ref: docs/02-design/mtus/MTU-N169-dora-metrics.design.md §3.8
 * Plan SC: FR-DORA.8
 */

export enum DORALevel {
  Low = 0,
  Medium = 1,
  High = 2,
  Elite = 3,
}

export interface DORAMetrics {
  /** 일평균 배포 횟수 */
  deploymentFrequency: number;
  /** 중앙값 리드타임 (초) */
  leadTimeSeconds: number;
  /** 변경 실패율 (0.0 ~ 1.0) */
  changeFailureRate: number;
  /** 중앙값 MTTR (초) */
  mttrSeconds: number;
}

interface ThresholdSet {
  dfMin: number;       // 일평균 배포 최소
  ltMax: number;       // 리드타임 최대 (초)
  cfrMax: number;      // 변경 실패율 최대
  mttrMax: number;     // MTTR 최대 (초)
}

/**
 * DORA 2024 보고서 기준 등급 분류
 * Design Ref: §3.8 등급 기준표
 */
const THRESHOLDS: Record<DORALevel, ThresholdSet> = {
  [DORALevel.Elite]: {
    dfMin: 2,           // 일 2회 이상
    ltMax: 3600,        // 1시간 이내
    cfrMax: 0.05,       // 5% 미만
    mttrMax: 3600,      // 1시간 이내
  },
  [DORALevel.High]: {
    dfMin: 0.14,        // 주 1회 이상 (1/7)
    ltMax: 86400,       // 1일 이내
    cfrMax: 0.10,       // 10% 미만
    mttrMax: 86400,     // 24시간 이내
  },
  [DORALevel.Medium]: {
    dfMin: 0.033,       // 월 1회 이상 (1/30)
    ltMax: 604800,      // 1주 이내
    cfrMax: 0.15,       // 15% 미만
    mttrMax: 604800,    // 7일 이내
  },
  [DORALevel.Low]: {
    dfMin: 0,
    ltMax: Infinity,
    cfrMax: 1.0,
    mttrMax: Infinity,
  },
};

export class DORAClassifier {
  /**
   * 4대 지표를 기반으로 DORA 등급 분류
   * 가장 낮은 개별 등급이 전체 등급을 결정 (병목 원리)
   */
  classify(metrics: DORAMetrics): DORALevel {
    const dfLevel = this.classifyDF(metrics.deploymentFrequency);
    const ltLevel = this.classifyLT(metrics.leadTimeSeconds);
    const cfrLevel = this.classifyCFR(metrics.changeFailureRate);
    const mttrLevel = this.classifyMTTR(metrics.mttrSeconds);

    return Math.min(dfLevel, ltLevel, cfrLevel, mttrLevel) as DORALevel;
  }

  /**
   * 개별 지표별 등급과 종합 등급을 상세 반환
   */
  classifyDetailed(metrics: DORAMetrics): {
    overall: DORALevel;
    breakdown: Record<string, DORALevel>;
    bottleneck: string;
  } {
    const breakdown = {
      deploymentFrequency: this.classifyDF(metrics.deploymentFrequency),
      leadTime: this.classifyLT(metrics.leadTimeSeconds),
      changeFailureRate: this.classifyCFR(metrics.changeFailureRate),
      mttr: this.classifyMTTR(metrics.mttrSeconds),
    };

    const overall = Math.min(
      ...Object.values(breakdown)
    ) as DORALevel;

    const bottleneck = Object.entries(breakdown)
      .reduce((min, [key, val]) => val < min[1] ? [key, val] : min, ['', Infinity] as [string, number])[0];

    return { overall, breakdown, bottleneck };
  }

  private classifyDF(frequency: number): DORALevel {
    if (frequency >= THRESHOLDS[DORALevel.Elite].dfMin) return DORALevel.Elite;
    if (frequency >= THRESHOLDS[DORALevel.High].dfMin) return DORALevel.High;
    if (frequency >= THRESHOLDS[DORALevel.Medium].dfMin) return DORALevel.Medium;
    return DORALevel.Low;
  }

  private classifyLT(seconds: number): DORALevel {
    if (seconds <= THRESHOLDS[DORALevel.Elite].ltMax) return DORALevel.Elite;
    if (seconds <= THRESHOLDS[DORALevel.High].ltMax) return DORALevel.High;
    if (seconds <= THRESHOLDS[DORALevel.Medium].ltMax) return DORALevel.Medium;
    return DORALevel.Low;
  }

  private classifyCFR(rate: number): DORALevel {
    if (rate <= THRESHOLDS[DORALevel.Elite].cfrMax) return DORALevel.Elite;
    if (rate <= THRESHOLDS[DORALevel.High].cfrMax) return DORALevel.High;
    if (rate <= THRESHOLDS[DORALevel.Medium].cfrMax) return DORALevel.Medium;
    return DORALevel.Low;
  }

  private classifyMTTR(seconds: number): DORALevel {
    if (seconds <= THRESHOLDS[DORALevel.Elite].mttrMax) return DORALevel.Elite;
    if (seconds <= THRESHOLDS[DORALevel.High].mttrMax) return DORALevel.High;
    if (seconds <= THRESHOLDS[DORALevel.Medium].mttrMax) return DORALevel.Medium;
    return DORALevel.Low;
  }
}
