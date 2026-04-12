// Design Ref: MTU-N143
// Plan SC: FR-N143.1~5

export interface AutoRollbackConfig { enabled: boolean; namespace: string; version: string; }
export interface AutoRollbackRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface AutoRollbackEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface AutoRollbackStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class AutoRollback {
  private rules: AutoRollbackRule[] = [];
  private events: AutoRollbackEvent[] = [];
  validateConfig(c: AutoRollbackConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: AutoRollbackRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): AutoRollbackEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: AutoRollbackEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): AutoRollbackStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): AutoRollbackEvent[] { return [...this.events]; }
}
