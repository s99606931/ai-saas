// Design Ref: MTU-N50 §Litmus 카오스 엔지니어링
// Plan SC: FR-N50.1~5

export interface LitmusChaosEngConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface LitmusChaosEngRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface LitmusChaosEngEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface LitmusChaosEngStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class LitmusChaosEng {
  private rules: LitmusChaosEngRule[] = [];
  private events: LitmusChaosEngEvent[] = [];

  /** FR-N50.1.1 설정 검증 */
  validateConfig(config: LitmusChaosEngConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  /** FR-N50.1.2 규칙 등록 */
  registerRule(rule: LitmusChaosEngRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  /** FR-N50.1.3 이벤트 평가 */
  evaluate(actor: string, resource: string, ruleId: string): LitmusChaosEngEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: LitmusChaosEngEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  /** FR-N50.1.4 상태 조회 */
  getStatus(): LitmusChaosEngStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  /** FR-N50.1.5 감사 로그 (CSAP D-06) */
  getAuditLog(): LitmusChaosEngEvent[] {
    return [...this.events];
  }
}

export const litmus_chaos_eng = new LitmusChaosEng();
