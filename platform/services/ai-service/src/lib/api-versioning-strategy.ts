// Design Ref: MTU-N165
// Plan SC: FR-N165.1~5

export interface ApiVersioningStrategyConfig { enabled: boolean; namespace: string; version: string; }
export interface ApiVersioningStrategyRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ApiVersioningStrategyEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ApiVersioningStrategyStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ApiVersioningStrategy {
  private rules: ApiVersioningStrategyRule[] = [];
  private events: ApiVersioningStrategyEvent[] = [];
  validateConfig(c: ApiVersioningStrategyConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ApiVersioningStrategyRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ApiVersioningStrategyEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ApiVersioningStrategyEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ApiVersioningStrategyStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ApiVersioningStrategyEvent[] { return [...this.events]; }
}
