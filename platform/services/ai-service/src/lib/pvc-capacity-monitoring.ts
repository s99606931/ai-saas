// Design Ref: MTU-N173
// Plan SC: FR-N173.1~5

export interface PvcCapacityMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface PvcCapacityMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface PvcCapacityMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface PvcCapacityMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class PvcCapacityMonitoring {
  private rules: PvcCapacityMonitoringRule[] = [];
  private events: PvcCapacityMonitoringEvent[] = [];
  validateConfig(c: PvcCapacityMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: PvcCapacityMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): PvcCapacityMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: PvcCapacityMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): PvcCapacityMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): PvcCapacityMonitoringEvent[] { return [...this.events]; }
}
