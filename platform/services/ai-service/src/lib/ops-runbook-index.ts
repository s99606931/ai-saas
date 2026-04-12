// Design Ref: MTU-N137
// Plan SC: FR-N137.1~5

export interface OpsRunbookIndexConfig { enabled: boolean; namespace: string; version: string; }
export interface OpsRunbookIndexRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface OpsRunbookIndexEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface OpsRunbookIndexStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class OpsRunbookIndex {
  private rules: OpsRunbookIndexRule[] = [];
  private events: OpsRunbookIndexEvent[] = [];
  validateConfig(c: OpsRunbookIndexConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: OpsRunbookIndexRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): OpsRunbookIndexEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: OpsRunbookIndexEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): OpsRunbookIndexStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): OpsRunbookIndexEvent[] { return [...this.events]; }
}
