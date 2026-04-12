// Design Ref: MTU-N30
// Plan SC: FR-N30.1~5

export interface ReleasePreparationConfig { enabled: boolean; namespace: string; version: string; }
export interface ReleasePreparationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ReleasePreparationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ReleasePreparationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ReleasePreparation {
  private rules: ReleasePreparationRule[] = [];
  private events: ReleasePreparationEvent[] = [];
  validateConfig(c: ReleasePreparationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ReleasePreparationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ReleasePreparationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ReleasePreparationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ReleasePreparationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ReleasePreparationEvent[] { return [...this.events]; }
}
