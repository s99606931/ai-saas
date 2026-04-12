// Design Ref: MTU-N225
// Plan SC: FR-N225.1~5

export interface RedisDetailedConfig { enabled: boolean; namespace: string; version: string; }
export interface RedisDetailedRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface RedisDetailedEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface RedisDetailedStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class RedisDetailed {
  private rules: RedisDetailedRule[] = [];
  private events: RedisDetailedEvent[] = [];
  validateConfig(c: RedisDetailedConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: RedisDetailedRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): RedisDetailedEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: RedisDetailedEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): RedisDetailedStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): RedisDetailedEvent[] { return [...this.events]; }
}
