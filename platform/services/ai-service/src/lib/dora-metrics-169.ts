// Design Ref: MTU-N169
// Plan SC: FR-N169.1~5

export interface DoraMetrics169Config { enabled: boolean; namespace: string; version: string; }
export interface DoraMetrics169Rule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface DoraMetrics169Event { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface DoraMetrics169Status { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class DoraMetrics169 {
  private rules: DoraMetrics169Rule[] = [];
  private events: DoraMetrics169Event[] = [];
  validateConfig(c: DoraMetrics169Config): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: DoraMetrics169Rule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): DoraMetrics169Event {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: DoraMetrics169Event = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): DoraMetrics169Status { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): DoraMetrics169Event[] { return [...this.events]; }
}
