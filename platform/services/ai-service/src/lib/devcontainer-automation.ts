// Design Ref: MTU-N58 §DevContainer 자동화
// Plan SC: FR-N58.1~5

export interface DevcontainerAutomationConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface DevcontainerAutomationRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface DevcontainerAutomationEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface DevcontainerAutomationStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class DevcontainerAutomation {
  private rules: DevcontainerAutomationRule[] = [];
  private events: DevcontainerAutomationEvent[] = [];

  validateConfig(config: DevcontainerAutomationConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  registerRule(rule: DevcontainerAutomationRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  evaluate(actor: string, resource: string, ruleId: string): DevcontainerAutomationEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: DevcontainerAutomationEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  getStatus(): DevcontainerAutomationStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  getAuditLog(): DevcontainerAutomationEvent[] {
    return [...this.events];
  }
}
