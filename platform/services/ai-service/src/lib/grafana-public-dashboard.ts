// Design Ref: MTU-N61 §Grafana 공공 대시보드
// Plan SC: FR-N61.1~5

export interface GrafanaPublicDashboardConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface GrafanaPublicDashboardRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface GrafanaPublicDashboardEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface GrafanaPublicDashboardStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class GrafanaPublicDashboard {
  private rules: GrafanaPublicDashboardRule[] = [];
  private events: GrafanaPublicDashboardEvent[] = [];

  validateConfig(config: GrafanaPublicDashboardConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  registerRule(rule: GrafanaPublicDashboardRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  evaluate(actor: string, resource: string, ruleId: string): GrafanaPublicDashboardEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: GrafanaPublicDashboardEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  getStatus(): GrafanaPublicDashboardStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  getAuditLog(): GrafanaPublicDashboardEvent[] {
    return [...this.events];
  }
}
