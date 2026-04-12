// Design Ref: MTU-N36
// Plan SC: FR-N36.1~5

export interface MonitoringSystemConfig { enabled: boolean; namespace: string; version: string; }
export interface MonitoringSystemRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface MonitoringSystemEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface MonitoringSystemStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class MonitoringSystem {
  private rules: MonitoringSystemRule[] = [];
  private events: MonitoringSystemEvent[] = [];
  validateConfig(c: MonitoringSystemConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: MonitoringSystemRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): MonitoringSystemEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: MonitoringSystemEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): MonitoringSystemStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): MonitoringSystemEvent[] { return [...this.events]; }
}
