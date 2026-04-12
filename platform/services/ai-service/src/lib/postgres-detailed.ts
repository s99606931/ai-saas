// Design Ref: MTU-N224
// Plan SC: FR-N224.1~5

export interface PostgresDetailedConfig { enabled: boolean; namespace: string; version: string; }
export interface PostgresDetailedRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface PostgresDetailedEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface PostgresDetailedStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class PostgresDetailed {
  private rules: PostgresDetailedRule[] = [];
  private events: PostgresDetailedEvent[] = [];
  validateConfig(c: PostgresDetailedConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: PostgresDetailedRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): PostgresDetailedEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: PostgresDetailedEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): PostgresDetailedStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): PostgresDetailedEvent[] { return [...this.events]; }
}
