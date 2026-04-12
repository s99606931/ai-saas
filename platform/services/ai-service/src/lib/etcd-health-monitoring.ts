// Design Ref: MTU-N176
// Plan SC: FR-N176.1~5

export interface EtcdHealthMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface EtcdHealthMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface EtcdHealthMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface EtcdHealthMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class EtcdHealthMonitoring {
  private rules: EtcdHealthMonitoringRule[] = [];
  private events: EtcdHealthMonitoringEvent[] = [];
  validateConfig(c: EtcdHealthMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: EtcdHealthMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): EtcdHealthMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: EtcdHealthMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): EtcdHealthMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): EtcdHealthMonitoringEvent[] { return [...this.events]; }
}
