// Design Ref: MTU-N55 §Velero DR 자동화
// Plan SC: FR-N55.1~5

export interface VeleroDrBackupConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface VeleroDrBackupRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface VeleroDrBackupEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface VeleroDrBackupStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class VeleroDrBackup {
  private rules: VeleroDrBackupRule[] = [];
  private events: VeleroDrBackupEvent[] = [];

  validateConfig(config: VeleroDrBackupConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  registerRule(rule: VeleroDrBackupRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  evaluate(actor: string, resource: string, ruleId: string): VeleroDrBackupEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: VeleroDrBackupEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  getStatus(): VeleroDrBackupStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  getAuditLog(): VeleroDrBackupEvent[] {
    return [...this.events];
  }
}
