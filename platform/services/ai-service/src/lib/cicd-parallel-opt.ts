// Design Ref: MTU-N51 §CI 병렬 최적화
// Plan SC: FR-N51.1~5

export interface CicdParallelOptConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface CicdParallelOptRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface CicdParallelOptEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface CicdParallelOptStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class CicdParallelOpt {
  private rules: CicdParallelOptRule[] = [];
  private events: CicdParallelOptEvent[] = [];

  /** FR-N51.1.1 설정 검증 */
  validateConfig(config: CicdParallelOptConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  /** FR-N51.1.2 규칙 등록 */
  registerRule(rule: CicdParallelOptRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  /** FR-N51.1.3 이벤트 평가 */
  evaluate(actor: string, resource: string, ruleId: string): CicdParallelOptEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: CicdParallelOptEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  /** FR-N51.1.4 상태 조회 */
  getStatus(): CicdParallelOptStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  /** FR-N51.1.5 감사 로그 (CSAP D-06) */
  getAuditLog(): CicdParallelOptEvent[] {
    return [...this.events];
  }
}

export const cicd_parallel_opt = new CicdParallelOpt();
