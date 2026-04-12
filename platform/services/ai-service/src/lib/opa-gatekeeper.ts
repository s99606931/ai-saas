// Design Ref: MTU-N53 §OPA Gatekeeper 정책
// Plan SC: FR-N53.1~5

export interface OpaGatekeeperConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface OpaGatekeeperRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface OpaGatekeeperEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface OpaGatekeeperStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class OpaGatekeeper {
  private rules: OpaGatekeeperRule[] = [];
  private events: OpaGatekeeperEvent[] = [];

  /** FR-N53.1.1 설정 검증 */
  validateConfig(config: OpaGatekeeperConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  /** FR-N53.1.2 규칙 등록 */
  registerRule(rule: OpaGatekeeperRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  /** FR-N53.1.3 이벤트 평가 */
  evaluate(actor: string, resource: string, ruleId: string): OpaGatekeeperEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: OpaGatekeeperEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  /** FR-N53.1.4 상태 조회 */
  getStatus(): OpaGatekeeperStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  /** FR-N53.1.5 감사 로그 (CSAP D-06) */
  getAuditLog(): OpaGatekeeperEvent[] {
    return [...this.events];
  }
}

export const opa_gatekeeper = new OpaGatekeeper();
