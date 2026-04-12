// Design Ref: MTU-N124
// Plan SC: FR-N124.1~5

export interface StatusPageGeneratorConfig { enabled: boolean; namespace: string; version: string; }
export interface StatusPageGeneratorRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface StatusPageGeneratorEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface StatusPageGeneratorStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class StatusPageGenerator {
  private rules: StatusPageGeneratorRule[] = [];
  private events: StatusPageGeneratorEvent[] = [];
  validateConfig(c: StatusPageGeneratorConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: StatusPageGeneratorRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): StatusPageGeneratorEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: StatusPageGeneratorEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): StatusPageGeneratorStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): StatusPageGeneratorEvent[] { return [...this.events]; }
}
