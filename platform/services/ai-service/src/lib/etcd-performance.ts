// Design Ref: MTU-N201
// Plan SC: FR-N201.1~5

export interface EtcdPerformanceConfig { enabled: boolean; namespace: string; version: string; }
export interface EtcdPerformanceRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface EtcdPerformanceEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface EtcdPerformanceStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class EtcdPerformance {
  private rules: EtcdPerformanceRule[] = [];
  private events: EtcdPerformanceEvent[] = [];
  validateConfig(c: EtcdPerformanceConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: EtcdPerformanceRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): EtcdPerformanceEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: EtcdPerformanceEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): EtcdPerformanceStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): EtcdPerformanceEvent[] { return [...this.events]; }
}
