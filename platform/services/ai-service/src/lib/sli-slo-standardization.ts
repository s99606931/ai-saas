// Design Ref: MTU-N142
// Plan SC: FR-N142.1~5

export interface SliSloStandardizationConfig { enabled: boolean; namespace: string; version: string; }
export interface SliSloStandardizationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SliSloStandardizationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SliSloStandardizationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SliSloStandardization {
  private rules: SliSloStandardizationRule[] = [];
  private events: SliSloStandardizationEvent[] = [];
  validateConfig(c: SliSloStandardizationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SliSloStandardizationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SliSloStandardizationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SliSloStandardizationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SliSloStandardizationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SliSloStandardizationEvent[] { return [...this.events]; }
}
