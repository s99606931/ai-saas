// Design Ref: MTU-N48 §Tempo 분산 추적
// Plan SC: FR-N48.1~5

export interface TempoDistributedTracingConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface TempoDistributedTracingRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface TempoDistributedTracingEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface TempoDistributedTracingStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class TempoDistributedTracing {
  private rules: TempoDistributedTracingRule[] = [];
  private events: TempoDistributedTracingEvent[] = [];

  /** FR-N48.1.1 설정 검증 */
  validateConfig(config: TempoDistributedTracingConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  /** FR-N48.1.2 규칙 등록 */
  registerRule(rule: TempoDistributedTracingRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  /** FR-N48.1.3 이벤트 평가 */
  evaluate(actor: string, resource: string, ruleId: string): TempoDistributedTracingEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: TempoDistributedTracingEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  /** FR-N48.1.4 상태 조회 */
  getStatus(): TempoDistributedTracingStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  /** FR-N48.1.5 감사 로그 (CSAP D-06) */
  getAuditLog(): TempoDistributedTracingEvent[] {
    return [...this.events];
  }
}

export const tempo_distributed_tracing = new TempoDistributedTracing();
