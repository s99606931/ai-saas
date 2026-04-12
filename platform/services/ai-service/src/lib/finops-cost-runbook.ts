// Design Ref: MTU-N59 §FinOps 비용 Runbook
// Plan SC: FR-N59.1~5

export interface FinopsCostRunbookConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface FinopsCostRunbookRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface FinopsCostRunbookEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface FinopsCostRunbookStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class FinopsCostRunbook {
  private rules: FinopsCostRunbookRule[] = [];
  private events: FinopsCostRunbookEvent[] = [];

  validateConfig(config: FinopsCostRunbookConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  registerRule(rule: FinopsCostRunbookRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  evaluate(actor: string, resource: string, ruleId: string): FinopsCostRunbookEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: FinopsCostRunbookEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  getStatus(): FinopsCostRunbookStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  getAuditLog(): FinopsCostRunbookEvent[] {
    return [...this.events];
  }
}
