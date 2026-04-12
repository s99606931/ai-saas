// Design Ref: MTU-N197
// Plan SC: FR-N197.1~5

export interface CronjobSlaConfig { enabled: boolean; namespace: string; version: string; }
export interface CronjobSlaRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CronjobSlaEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CronjobSlaStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CronjobSla {
  private rules: CronjobSlaRule[] = [];
  private events: CronjobSlaEvent[] = [];
  validateConfig(c: CronjobSlaConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CronjobSlaRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CronjobSlaEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CronjobSlaEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CronjobSlaStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CronjobSlaEvent[] { return [...this.events]; }
}
