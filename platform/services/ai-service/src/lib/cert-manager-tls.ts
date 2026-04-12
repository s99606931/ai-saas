// Design Ref: MTU-N62 §cert-manager TLS
// Plan SC: FR-N62.1~5

export interface CertManagerTlsConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface CertManagerTlsRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface CertManagerTlsEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface CertManagerTlsStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class CertManagerTls {
  private rules: CertManagerTlsRule[] = [];
  private events: CertManagerTlsEvent[] = [];

  validateConfig(config: CertManagerTlsConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  registerRule(rule: CertManagerTlsRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  evaluate(actor: string, resource: string, ruleId: string): CertManagerTlsEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: CertManagerTlsEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  getStatus(): CertManagerTlsStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  getAuditLog(): CertManagerTlsEvent[] {
    return [...this.events];
  }
}
