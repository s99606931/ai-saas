// Design Ref: MTU-N36b
// Plan SC: FR-N36b.1~5

export interface ReleaseUpdateConfig { enabled: boolean; namespace: string; version: string; }
export interface ReleaseUpdateRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ReleaseUpdateEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ReleaseUpdateStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ReleaseUpdate {
  private rules: ReleaseUpdateRule[] = [];
  private events: ReleaseUpdateEvent[] = [];
  validateConfig(c: ReleaseUpdateConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ReleaseUpdateRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ReleaseUpdateEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ReleaseUpdateEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ReleaseUpdateStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ReleaseUpdateEvent[] { return [...this.events]; }
}
