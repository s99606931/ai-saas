// Design Ref: MTU-N89
// Plan SC: FR-N89.1~5

export interface AuditCompletenessConfig { enabled: boolean; namespace: string; version: string; }
export interface AuditCompletenessRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface AuditCompletenessEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface AuditCompletenessStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class AuditCompleteness {
  private rules: AuditCompletenessRule[] = [];
  private events: AuditCompletenessEvent[] = [];
  validateConfig(c: AuditCompletenessConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: AuditCompletenessRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): AuditCompletenessEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: AuditCompletenessEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): AuditCompletenessStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): AuditCompletenessEvent[] { return [...this.events]; }
}
