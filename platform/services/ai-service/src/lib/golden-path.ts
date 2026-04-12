// Design Ref: MTU-N86
// Plan SC: FR-N86.1~5

export interface GoldenPathConfig { enabled: boolean; namespace: string; version: string; }
export interface GoldenPathRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface GoldenPathEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface GoldenPathStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class GoldenPath {
  private rules: GoldenPathRule[] = [];
  private events: GoldenPathEvent[] = [];
  validateConfig(c: GoldenPathConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: GoldenPathRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): GoldenPathEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: GoldenPathEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): GoldenPathStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): GoldenPathEvent[] { return [...this.events]; }
}
