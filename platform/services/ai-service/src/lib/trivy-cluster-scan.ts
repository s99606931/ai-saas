// Design Ref: MTU-N63 §Trivy 클러스터 스캔
// Plan SC: FR-N63.1~5

export interface TrivyClusterScanConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface TrivyClusterScanRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface TrivyClusterScanEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface TrivyClusterScanStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class TrivyClusterScan {
  private rules: TrivyClusterScanRule[] = [];
  private events: TrivyClusterScanEvent[] = [];

  validateConfig(config: TrivyClusterScanConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  registerRule(rule: TrivyClusterScanRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  evaluate(actor: string, resource: string, ruleId: string): TrivyClusterScanEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: TrivyClusterScanEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  getStatus(): TrivyClusterScanStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  getAuditLog(): TrivyClusterScanEvent[] {
    return [...this.events];
  }
}
