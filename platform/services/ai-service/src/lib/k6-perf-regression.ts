// Design Ref: MTU-N171
// Plan SC: FR-N171.1~5

export interface K6PerfRegressionConfig { enabled: boolean; namespace: string; version: string; }
export interface K6PerfRegressionRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface K6PerfRegressionEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface K6PerfRegressionStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class K6PerfRegression {
  private rules: K6PerfRegressionRule[] = [];
  private events: K6PerfRegressionEvent[] = [];
  validateConfig(c: K6PerfRegressionConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: K6PerfRegressionRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): K6PerfRegressionEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: K6PerfRegressionEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): K6PerfRegressionStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): K6PerfRegressionEvent[] { return [...this.events]; }
}
