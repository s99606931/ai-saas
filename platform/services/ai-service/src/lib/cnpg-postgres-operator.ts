// Design Ref: MTU-N64 §CNPG PostgreSQL
// Plan SC: FR-N64.1~5

export interface CnpgPostgresOperatorConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface CnpgPostgresOperatorRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface CnpgPostgresOperatorEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface CnpgPostgresOperatorStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class CnpgPostgresOperator {
  private rules: CnpgPostgresOperatorRule[] = [];
  private events: CnpgPostgresOperatorEvent[] = [];

  validateConfig(config: CnpgPostgresOperatorConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  registerRule(rule: CnpgPostgresOperatorRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  evaluate(actor: string, resource: string, ruleId: string): CnpgPostgresOperatorEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: CnpgPostgresOperatorEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  getStatus(): CnpgPostgresOperatorStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  getAuditLog(): CnpgPostgresOperatorEvent[] {
    return [...this.events];
  }
}
