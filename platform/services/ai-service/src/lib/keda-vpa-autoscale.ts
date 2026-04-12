// Design Ref: MTU-N56 §KEDA 오토스케일링
// Plan SC: FR-N56.1~5

export interface KedaVpaAutoscaleConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface KedaVpaAutoscaleRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface KedaVpaAutoscaleEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface KedaVpaAutoscaleStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class KedaVpaAutoscale {
  private rules: KedaVpaAutoscaleRule[] = [];
  private events: KedaVpaAutoscaleEvent[] = [];

  validateConfig(config: KedaVpaAutoscaleConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  registerRule(rule: KedaVpaAutoscaleRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  evaluate(actor: string, resource: string, ruleId: string): KedaVpaAutoscaleEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: KedaVpaAutoscaleEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  getStatus(): KedaVpaAutoscaleStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  getAuditLog(): KedaVpaAutoscaleEvent[] {
    return [...this.events];
  }
}
