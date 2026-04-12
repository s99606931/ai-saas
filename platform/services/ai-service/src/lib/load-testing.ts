// Design Ref: MTU-N33
// Plan SC: FR-N33.1~5

export interface LoadTestingConfig { enabled: boolean; namespace: string; version: string; }
export interface LoadTestingRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface LoadTestingEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface LoadTestingStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class LoadTesting {
  private rules: LoadTestingRule[] = [];
  private events: LoadTestingEvent[] = [];
  validateConfig(c: LoadTestingConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: LoadTestingRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): LoadTestingEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: LoadTestingEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): LoadTestingStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): LoadTestingEvent[] { return [...this.events]; }
}
