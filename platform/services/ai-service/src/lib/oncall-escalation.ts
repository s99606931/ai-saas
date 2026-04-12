// Design Ref: MTU-N122
// Plan SC: FR-N122.1~5

export interface OncallEscalationConfig { enabled: boolean; namespace: string; version: string; }
export interface OncallEscalationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface OncallEscalationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface OncallEscalationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class OncallEscalation {
  private rules: OncallEscalationRule[] = [];
  private events: OncallEscalationEvent[] = [];
  validateConfig(c: OncallEscalationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: OncallEscalationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): OncallEscalationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: OncallEscalationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): OncallEscalationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): OncallEscalationEvent[] { return [...this.events]; }
}
