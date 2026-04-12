// Design Ref: MTU-N235
// Plan SC: FR-N235.1~5

export interface Round24IntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface Round24IntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Round24IntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Round24IntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Round24Integration {
  private rules: Round24IntegrationRule[] = [];
  private events: Round24IntegrationEvent[] = [];
  validateConfig(c: Round24IntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Round24IntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Round24IntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Round24IntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Round24IntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Round24IntegrationEvent[] { return [...this.events]; }
}
