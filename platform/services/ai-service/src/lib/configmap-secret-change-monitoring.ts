// Design Ref: MTU-N188
// Plan SC: FR-N188.1~5

export interface ConfigmapSecretChangeMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface ConfigmapSecretChangeMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ConfigmapSecretChangeMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ConfigmapSecretChangeMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ConfigmapSecretChangeMonitoring {
  private rules: ConfigmapSecretChangeMonitoringRule[] = [];
  private events: ConfigmapSecretChangeMonitoringEvent[] = [];
  validateConfig(c: ConfigmapSecretChangeMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ConfigmapSecretChangeMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ConfigmapSecretChangeMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ConfigmapSecretChangeMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ConfigmapSecretChangeMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ConfigmapSecretChangeMonitoringEvent[] { return [...this.events]; }
}
