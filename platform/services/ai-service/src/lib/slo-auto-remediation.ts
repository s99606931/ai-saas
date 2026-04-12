// Design Ref: MTU-N426 §SLO 자동 교정
// Plan SC: FR-N426.1~5

export interface SLODefinition {
  serviceId: string;
  metric: 'availability' | 'latency' | 'errorRate';
  target: number;
  windowDays: number;
}

export interface SLOState {
  serviceId: string;
  currentValue: number;
  errorBudgetRemaining: number;
  burnRatePerHour: number;
}

export type RemediationAction =
  | 'scale-out'
  | 'rollback-deploy'
  | 'failover-region'
  | 'enable-circuit-breaker'
  | 'no-action';

export interface RemediationPlan {
  serviceId: string;
  cause: 'traffic-spike' | 'bad-deploy' | 'dependency-failure' | 'unknown';
  action: RemediationAction;
  confidence: number;
  reason: string;
}

export interface RemediationResult {
  planId: string;
  executedAt: string;
  success: boolean;
  sloImprovedBy: number;
}

export class SLOAutoRemediation {
  private history: RemediationResult[] = [];

  /** FR-N426.1 위반 감지 */
  detectViolation(state: SLOState, slo: SLODefinition): {
    violated: boolean;
    severity: 'ok' | 'warn' | 'critical';
  } {
    const targetViolated = slo.metric === 'errorRate'
      ? state.currentValue > slo.target
      : state.currentValue < slo.target;
    if (!targetViolated && state.burnRatePerHour < 2) {
      return { violated: false, severity: 'ok' };
    }
    if (state.burnRatePerHour >= 14 || state.errorBudgetRemaining < 0.1) {
      return { violated: true, severity: 'critical' };
    }
    return { violated: true, severity: 'warn' };
  }

  /** FR-N426.2 원인 분류 */
  classifyCause(signals: {
    trafficSpikeDetected: boolean;
    recentDeployWithin5Min: boolean;
    dependencyErrorRate: number;
  }): RemediationPlan['cause'] {
    if (signals.recentDeployWithin5Min) return 'bad-deploy';
    if (signals.dependencyErrorRate > 0.1) return 'dependency-failure';
    if (signals.trafficSpikeDetected) return 'traffic-spike';
    return 'unknown';
  }

  /** FR-N426.3 액션 선택 */
  selectAction(cause: RemediationPlan['cause']): { action: RemediationAction; confidence: number } {
    switch (cause) {
      case 'traffic-spike':
        return { action: 'scale-out', confidence: 0.85 };
      case 'bad-deploy':
        return { action: 'rollback-deploy', confidence: 0.9 };
      case 'dependency-failure':
        return { action: 'enable-circuit-breaker', confidence: 0.75 };
      default:
        return { action: 'no-action', confidence: 0.3 };
    }
  }

  /** 종합 플랜 */
  plan(state: SLOState, slo: SLODefinition, signals: {
    trafficSpikeDetected: boolean;
    recentDeployWithin5Min: boolean;
    dependencyErrorRate: number;
  }): RemediationPlan | null {
    const violation = this.detectViolation(state, slo);
    if (!violation.violated) return null;
    const cause = this.classifyCause(signals);
    const { action, confidence } = this.selectAction(cause);
    return {
      serviceId: state.serviceId,
      cause,
      action,
      confidence,
      reason: `${violation.severity} 상태 — ${cause} 추정`,
    };
  }

  /** FR-N426.4 실행 결과 기록 */
  recordResult(result: RemediationResult): void {
    this.history.push(result);
  }

  /** FR-N426.5 액션별 성공률 */
  getSuccessRate(action: RemediationAction): number {
    const relevant = this.history.filter((r) => r.planId.includes(action));
    if (relevant.length === 0) return 0;
    const success = relevant.filter((r) => r.success).length;
    return +(success / relevant.length).toFixed(2);
  }

  getHistoryCount(): number {
    return this.history.length;
  }
}

export const sloAutoRemediation = new SLOAutoRemediation();
