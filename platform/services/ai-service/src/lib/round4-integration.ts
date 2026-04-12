// Design Ref: MTU-N68
// Plan SC: FR-N68.1~5

export interface Round4IntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface Round4IntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Round4IntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Round4IntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Round4Integration {
  private rules: Round4IntegrationRule[] = [];
  private events: Round4IntegrationEvent[] = [];
  validateConfig(c: Round4IntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Round4IntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Round4IntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Round4IntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Round4IntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Round4IntegrationEvent[] { return [...this.events]; }
}
