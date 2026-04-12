// Design Ref: MTU-N47 §Flux Drift Detection
// Plan SC: FR-N47.1~5

export interface FluxDriftDetectionConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface FluxDriftDetectionRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface FluxDriftDetectionEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface FluxDriftDetectionStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class FluxDriftDetection {
  private rules: FluxDriftDetectionRule[] = [];
  private events: FluxDriftDetectionEvent[] = [];

  /** FR-N47.1.1 설정 검증 */
  validateConfig(config: FluxDriftDetectionConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  /** FR-N47.1.2 규칙 등록 */
  registerRule(rule: FluxDriftDetectionRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  /** FR-N47.1.3 이벤트 평가 */
  evaluate(actor: string, resource: string, ruleId: string): FluxDriftDetectionEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: FluxDriftDetectionEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  /** FR-N47.1.4 상태 조회 */
  getStatus(): FluxDriftDetectionStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  /** FR-N47.1.5 감사 로그 (CSAP D-06) */
  getAuditLog(): FluxDriftDetectionEvent[] {
    return [...this.events];
  }
}

export const flux_drift_detection = new FluxDriftDetection();
