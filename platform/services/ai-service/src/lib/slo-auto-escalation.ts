// Design Ref: MTU-N178
// Plan SC: FR-N178.1~5

export interface SloAutoEscalationConfig { enabled: boolean; namespace: string; version: string; }
export interface SloAutoEscalationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SloAutoEscalationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SloAutoEscalationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SloAutoEscalation {
  private rules: SloAutoEscalationRule[] = [];
  private events: SloAutoEscalationEvent[] = [];
  validateConfig(c: SloAutoEscalationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SloAutoEscalationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SloAutoEscalationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SloAutoEscalationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SloAutoEscalationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SloAutoEscalationEvent[] { return [...this.events]; }
}
