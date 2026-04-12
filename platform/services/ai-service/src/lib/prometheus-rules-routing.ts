// Design Ref: MTU-N57 §Prometheus Rules 라우팅
// Plan SC: FR-N57.1~5

export interface PrometheusRulesRoutingConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface PrometheusRulesRoutingRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface PrometheusRulesRoutingEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface PrometheusRulesRoutingStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class PrometheusRulesRouting {
  private rules: PrometheusRulesRoutingRule[] = [];
  private events: PrometheusRulesRoutingEvent[] = [];

  validateConfig(config: PrometheusRulesRoutingConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  registerRule(rule: PrometheusRulesRoutingRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  evaluate(actor: string, resource: string, ruleId: string): PrometheusRulesRoutingEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: PrometheusRulesRoutingEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  getStatus(): PrometheusRulesRoutingStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  getAuditLog(): PrometheusRulesRoutingEvent[] {
    return [...this.events];
  }
}
