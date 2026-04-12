// Design Ref: MTU-N172
// Plan SC: FR-N172.1~5

export interface FluxSyncMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface FluxSyncMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface FluxSyncMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface FluxSyncMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class FluxSyncMonitoring {
  private rules: FluxSyncMonitoringRule[] = [];
  private events: FluxSyncMonitoringEvent[] = [];
  validateConfig(c: FluxSyncMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: FluxSyncMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): FluxSyncMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: FluxSyncMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): FluxSyncMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): FluxSyncMonitoringEvent[] { return [...this.events]; }
}
