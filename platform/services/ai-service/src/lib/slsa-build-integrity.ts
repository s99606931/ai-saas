// Design Ref: MTU-N46 §SLSA L3 빌드 무결성
// Plan SC: FR-N46.1~5

export interface SlsaBuildIntegrityConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface SlsaBuildIntegrityRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface SlsaBuildIntegrityEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface SlsaBuildIntegrityStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class SlsaBuildIntegrity {
  private rules: SlsaBuildIntegrityRule[] = [];
  private events: SlsaBuildIntegrityEvent[] = [];

  /** FR-N46.1.1 설정 검증 */
  validateConfig(config: SlsaBuildIntegrityConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  /** FR-N46.1.2 규칙 등록 */
  registerRule(rule: SlsaBuildIntegrityRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  /** FR-N46.1.3 이벤트 평가 */
  evaluate(actor: string, resource: string, ruleId: string): SlsaBuildIntegrityEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: SlsaBuildIntegrityEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  /** FR-N46.1.4 상태 조회 */
  getStatus(): SlsaBuildIntegrityStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  /** FR-N46.1.5 감사 로그 (CSAP D-06) */
  getAuditLog(): SlsaBuildIntegrityEvent[] {
    return [...this.events];
  }
}

export const slsa_build_integrity = new SlsaBuildIntegrity();
