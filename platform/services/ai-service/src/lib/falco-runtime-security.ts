// Design Ref: MTU-N45 §Falco 런타임 보안
// Plan SC: FR-N45.1~5

export interface FalcoRuntimeSecurityConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface FalcoRuntimeSecurityRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface FalcoRuntimeSecurityEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface FalcoRuntimeSecurityStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class FalcoRuntimeSecurity {
  private rules: FalcoRuntimeSecurityRule[] = [];
  private events: FalcoRuntimeSecurityEvent[] = [];

  /** FR-N45.1.1 설정 검증 */
  validateConfig(config: FalcoRuntimeSecurityConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  /** FR-N45.1.2 규칙 등록 */
  registerRule(rule: FalcoRuntimeSecurityRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  /** FR-N45.1.3 이벤트 평가 */
  evaluate(actor: string, resource: string, ruleId: string): FalcoRuntimeSecurityEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: FalcoRuntimeSecurityEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  /** FR-N45.1.4 상태 조회 */
  getStatus(): FalcoRuntimeSecurityStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  /** FR-N45.1.5 감사 로그 (CSAP D-06) */
  getAuditLog(): FalcoRuntimeSecurityEvent[] {
    return [...this.events];
  }
}

export const falco_runtime_security = new FalcoRuntimeSecurity();
