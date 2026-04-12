// Design Ref: MTU-N428 §배포 위험도 예측
// Plan SC: FR-N428.1~5

export interface DeployChange {
  deployId: string;
  serviceId: string;
  filesChanged: number;
  linesChanged: number;
  criticalPathTouched: boolean;
  testCoverage: number;
  hasDbMigration: boolean;
  plannedAt: string;
}

export interface HistoricalIncident {
  deployId: string;
  failed: boolean;
  rollbackWithinMinutes?: number;
}

export interface RiskPrediction {
  deployId: string;
  riskScore: number;
  riskLevel: 'low' | 'med' | 'high';
  factors: Array<{ factor: string; contribution: number }>;
  mitigations: string[];
}

export class DeployRiskPredictor {
  /** FR-N428.2 과거 실패율 */
  calcHistoricalFailRate(history: HistoricalIncident[]): number {
    if (history.length === 0) return 0.1;
    const failed = history.filter((h) => h.failed).length;
    return +(failed / history.length).toFixed(3);
  }

  /** FR-N428.1,2,3 종합 예측 */
  predict(change: DeployChange, history: HistoricalIncident[]): RiskPrediction {
    const factors: RiskPrediction['factors'] = [];
    const baseRate = this.calcHistoricalFailRate(history);
    factors.push({ factor: 'historical-rate', contribution: baseRate });

    let score = baseRate;

    // 변경 규모
    if (change.filesChanged > 50) {
      score += 0.2;
      factors.push({ factor: 'large-file-count', contribution: 0.2 });
    } else if (change.filesChanged > 20) {
      score += 0.1;
      factors.push({ factor: 'medium-file-count', contribution: 0.1 });
    }
    if (change.linesChanged > 1000) {
      score += 0.15;
      factors.push({ factor: 'large-loc', contribution: 0.15 });
    }

    // 핵심 경로
    if (change.criticalPathTouched) {
      score += 0.2;
      factors.push({ factor: 'critical-path', contribution: 0.2 });
    }

    // DB 마이그레이션
    if (change.hasDbMigration) {
      score += 0.15;
      factors.push({ factor: 'db-migration', contribution: 0.15 });
    }

    // 테스트 커버리지 보정
    if (change.testCoverage < 0.6) {
      score += 0.15;
      factors.push({ factor: 'low-coverage', contribution: 0.15 });
    } else if (change.testCoverage >= 0.85) {
      score -= 0.1;
      factors.push({ factor: 'high-coverage', contribution: -0.1 });
    }

    // 배포 시점 (금요일/야간)
    const d = new Date(change.plannedAt);
    const day = d.getUTCDay();
    const hour = d.getUTCHours();
    if (day === 5 || day === 6) {
      score += 0.1;
      factors.push({ factor: 'weekend-deploy', contribution: 0.1 });
    }
    if (hour < 6 || hour > 20) {
      score += 0.05;
      factors.push({ factor: 'off-hours', contribution: 0.05 });
    }

    score = Math.max(0, Math.min(1, score));
    const level: RiskPrediction['riskLevel'] = score >= 0.6 ? 'high' : score >= 0.3 ? 'med' : 'low';

    return {
      deployId: change.deployId,
      riskScore: +score.toFixed(3),
      riskLevel: level,
      factors,
      mitigations: this.suggestMitigations(change, level),
    };
  }

  /** FR-N428.5 완화 전략 */
  private suggestMitigations(change: DeployChange, level: RiskPrediction['riskLevel']): string[] {
    const out: string[] = [];
    if (level === 'high') {
      out.push('카나리 배포 (5% → 25% → 100%)');
      out.push('피처 플래그로 감시 후 점진 활성화');
    }
    if (change.hasDbMigration) out.push('마이그레이션 롤백 스크립트 사전 검증');
    if (change.testCoverage < 0.7) out.push('핵심 경로 통합 테스트 추가');
    if (change.criticalPathTouched) out.push('On-call 대기 강화 + 롤백 자동화');
    return out;
  }
}

export const deployRiskPredictor = new DeployRiskPredictor();
