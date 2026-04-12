// Design Ref: MTU-N202
// Plan SC: FR-N202.1~5

export interface CorednsPerformanceConfig { enabled: boolean; namespace: string; version: string; }
export interface CorednsPerformanceRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CorednsPerformanceEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CorednsPerformanceStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CorednsPerformance {
  private rules: CorednsPerformanceRule[] = [];
  private events: CorednsPerformanceEvent[] = [];
  validateConfig(c: CorednsPerformanceConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CorednsPerformanceRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CorednsPerformanceEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CorednsPerformanceEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CorednsPerformanceStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CorednsPerformanceEvent[] { return [...this.events]; }
}
