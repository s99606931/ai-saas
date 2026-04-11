/**
 * DORA 추세 분석기
 * Design Ref: docs/02-design/mtus/MTU-N251-dora-four-keys.design.md §3.1
 * Plan SC: FR-N251.6, FR-N251.9
 *
 * 주간/월간 DORA 메트릭 추세 분석 및 개선율 계산
 */

import { DORAClassifier, DORALevel, DORAMetrics } from './classifier';

/** 추세 스냅샷: 특정 시점의 Four Keys 값 */
export interface TrendSnapshot {
  /** 스냅샷 생성 시각 (ISO 8601) */
  timestamp: string;
  /** 배포 빈도 (일평균) */
  deploymentFrequency: number;
  /** 중앙값 리드타임 (초) */
  leadTimeSeconds: number;
  /** 변경 실패율 (0.0 ~ 1.0) */
  changeFailureRate: number;
  /** 중앙값 MTTR (초) */
  mttrSeconds: number;
  /** DORA 종합 등급 */
  level: DORALevel;
}

/** 개선율 지표 */
export interface ImprovementMetrics {
  /** 배포 빈도 변화율 (양수 = 개선) */
  deploymentFrequencyChange: number;
  /** 리드타임 변화율 (음수 = 개선) */
  leadTimeChange: number;
  /** CFR 변화율 (음수 = 개선) */
  changeFailureRateChange: number;
  /** MTTR 변화율 (음수 = 개선) */
  mttrChange: number;
  /** 등급 변화 (양수 = 상승) */
  levelChange: number;
  /** 전체 개선 점수 (0~100, 높을수록 좋음) */
  overallScore: number;
}

/** 추세 보고서 */
export interface TrendReport {
  /** 분석 기간 */
  period: string;
  /** 현재 스냅샷 */
  current: TrendSnapshot;
  /** 이전 기간 스냅샷 */
  previous: TrendSnapshot | null;
  /** 개선율 */
  improvement: ImprovementMetrics | null;
  /** 개선 권고사항 */
  recommendations: string[];
}

export class TrendAnalyzer {
  private snapshots: TrendSnapshot[] = [];
  private readonly maxSnapshots = 365; // 1년치 보관
  private readonly classifier = new DORAClassifier();

  /**
   * 현재 메트릭으로 스냅샷 기록
   * Design Ref: §3.1 — 주기적 스냅샷 저장
   */
  recordSnapshot(metrics: DORAMetrics): TrendSnapshot {
    const level = this.classifier.classify(metrics);
    const snapshot: TrendSnapshot = {
      timestamp: new Date().toISOString(),
      deploymentFrequency: metrics.deploymentFrequency,
      leadTimeSeconds: metrics.leadTimeSeconds,
      changeFailureRate: metrics.changeFailureRate,
      mttrSeconds: metrics.mttrSeconds,
      level,
    };

    this.snapshots.push(snapshot);

    // 메모리 관리: 최대 스냅샷 수 초과 시 오래된 것 제거
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    return snapshot;
  }

  /**
   * 주간 추세 분석
   * Design Ref: §3.1 — 이번 주 vs 지난 주 비교
   */
  analyzeWeekly(): TrendReport {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const currentPeriod = this.getSnapshotsInRange(oneWeekAgo, now);
    const previousPeriod = this.getSnapshotsInRange(twoWeeksAgo, oneWeekAgo);

    const current = this.aggregateSnapshots(currentPeriod);
    const previous = previousPeriod.length > 0
      ? this.aggregateSnapshots(previousPeriod)
      : null;

    const improvement = previous
      ? this.calculateImprovement(current, previous)
      : null;

    const recommendations = this.generateRecommendations(current, improvement);

    return {
      period: 'weekly',
      current,
      previous,
      improvement,
      recommendations,
    };
  }

  /**
   * 월간 추세 분석
   * Design Ref: §3.1 — 이번 달 vs 지난 달 비교
   */
  analyzeMonthly(): TrendReport {
    const now = Date.now();
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const twoMonthsAgo = now - 60 * 24 * 60 * 60 * 1000;

    const currentPeriod = this.getSnapshotsInRange(oneMonthAgo, now);
    const previousPeriod = this.getSnapshotsInRange(twoMonthsAgo, oneMonthAgo);

    const current = this.aggregateSnapshots(currentPeriod);
    const previous = previousPeriod.length > 0
      ? this.aggregateSnapshots(previousPeriod)
      : null;

    const improvement = previous
      ? this.calculateImprovement(current, previous)
      : null;

    const recommendations = this.generateRecommendations(current, improvement);

    return {
      period: 'monthly',
      current,
      previous,
      improvement,
      recommendations,
    };
  }

  /**
   * 개선율 계산
   * Design Ref: §3.1 — 각 지표별 변화율 및 종합 점수
   */
  calculateImprovement(
    current: TrendSnapshot,
    previous: TrendSnapshot,
  ): ImprovementMetrics {
    // 배포 빈도: 높을수록 좋음 → 양수 = 개선
    const dfChange = previous.deploymentFrequency > 0
      ? ((current.deploymentFrequency - previous.deploymentFrequency) / previous.deploymentFrequency) * 100
      : 0;

    // 리드타임: 낮을수록 좋음 → 음수 = 개선
    const ltChange = previous.leadTimeSeconds > 0
      ? ((current.leadTimeSeconds - previous.leadTimeSeconds) / previous.leadTimeSeconds) * 100
      : 0;

    // CFR: 낮을수록 좋음 → 음수 = 개선
    const cfrChange = previous.changeFailureRate > 0
      ? ((current.changeFailureRate - previous.changeFailureRate) / previous.changeFailureRate) * 100
      : 0;

    // MTTR: 낮을수록 좋음 → 음수 = 개선
    const mttrChange = previous.mttrSeconds > 0
      ? ((current.mttrSeconds - previous.mttrSeconds) / previous.mttrSeconds) * 100
      : 0;

    // 등급 변화
    const levelChange = current.level - previous.level;

    // 종합 점수: 각 지표 개선율 가중 평균 (0~100)
    const dfScore = Math.min(100, Math.max(0, 50 + dfChange));
    const ltScore = Math.min(100, Math.max(0, 50 - ltChange));
    const cfrScore = Math.min(100, Math.max(0, 50 - cfrChange));
    const mttrScore = Math.min(100, Math.max(0, 50 - mttrChange));
    const overallScore = (dfScore + ltScore + cfrScore + mttrScore) / 4;

    return {
      deploymentFrequencyChange: Math.round(dfChange * 100) / 100,
      leadTimeChange: Math.round(ltChange * 100) / 100,
      changeFailureRateChange: Math.round(cfrChange * 100) / 100,
      mttrChange: Math.round(mttrChange * 100) / 100,
      levelChange,
      overallScore: Math.round(overallScore * 100) / 100,
    };
  }

  /**
   * 스냅샷 수
   */
  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  /**
   * 최근 N개 스냅샷 반환
   */
  getRecentSnapshots(count: number): TrendSnapshot[] {
    return this.snapshots.slice(-count);
  }

  /**
   * 범위 내 스냅샷 필터링
   */
  private getSnapshotsInRange(from: number, to: number): TrendSnapshot[] {
    return this.snapshots.filter(s => {
      const ts = new Date(s.timestamp).getTime();
      return ts >= from && ts <= to;
    });
  }

  /**
   * 스냅샷 배열을 하나의 대표 스냅샷으로 집계
   */
  private aggregateSnapshots(snapshots: TrendSnapshot[]): TrendSnapshot {
    if (snapshots.length === 0) {
      return {
        timestamp: new Date().toISOString(),
        deploymentFrequency: 0,
        leadTimeSeconds: 0,
        changeFailureRate: 0,
        mttrSeconds: 0,
        level: DORALevel.Low,
      };
    }

    const avg = (arr: number[]) =>
      arr.reduce((sum, v) => sum + v, 0) / arr.length;

    const df = avg(snapshots.map(s => s.deploymentFrequency));
    const lt = avg(snapshots.map(s => s.leadTimeSeconds));
    const cfr = avg(snapshots.map(s => s.changeFailureRate));
    const mttr = avg(snapshots.map(s => s.mttrSeconds));

    const level = this.classifier.classify({
      deploymentFrequency: df,
      leadTimeSeconds: lt,
      changeFailureRate: cfr,
      mttrSeconds: mttr,
    });

    return {
      timestamp: snapshots[snapshots.length - 1].timestamp,
      deploymentFrequency: Math.round(df * 1000) / 1000,
      leadTimeSeconds: Math.round(lt),
      changeFailureRate: Math.round(cfr * 10000) / 10000,
      mttrSeconds: Math.round(mttr),
      level,
    };
  }

  /**
   * 개선 권고사항 자동 생성
   * Design Ref: §3.8 — 감리 증빙 형식
   */
  private generateRecommendations(
    current: TrendSnapshot,
    improvement: ImprovementMetrics | null,
  ): string[] {
    const recommendations: string[] = [];

    // 배포 빈도 분석
    if (current.deploymentFrequency < 0.14) {
      recommendations.push(
        '[DF] 배포 빈도가 주 1회 미만입니다. CI/CD 파이프라인 자동화를 강화하십시오.',
      );
    }

    // 리드타임 분석
    if (current.leadTimeSeconds > 86400) {
      recommendations.push(
        '[LT] 변경 리드타임이 24시간을 초과합니다. 코드 리뷰 병목 또는 테스트 자동화를 확인하십시오.',
      );
    }

    // CFR 분석
    if (current.changeFailureRate > 0.15) {
      recommendations.push(
        '[CFR] 변경 실패율이 15%를 초과합니다. 테스트 커버리지 확대 및 카나리 배포를 도입하십시오.',
      );
    }

    // MTTR 분석
    if (current.mttrSeconds > 3600) {
      recommendations.push(
        '[MTTR] 평균 복구 시간이 1시간을 초과합니다. SRE 런북 및 자동 롤백 절차를 검토하십시오.',
      );
    }

    // 악화 추세 경고
    if (improvement) {
      if (improvement.deploymentFrequencyChange < -20) {
        recommendations.push(
          '[추세] 배포 빈도가 20% 이상 감소했습니다. 배포 차단 요인을 점검하십시오.',
        );
      }
      if (improvement.leadTimeChange > 20) {
        recommendations.push(
          '[추세] 리드타임이 20% 이상 증가했습니다. 파이프라인 병목을 분석하십시오.',
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push(
        '[양호] 모든 DORA 지표가 양호합니다. 현재 수준을 유지하십시오.',
      );
    }

    return recommendations;
  }
}
