// Design Ref: MTU-N164
// Plan SC: FR-N164.1~5

export interface Round13IntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface Round13IntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Round13IntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Round13IntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Round13Integration {
  private rules: Round13IntegrationRule[] = [];
  private events: Round13IntegrationEvent[] = [];
  validateConfig(c: Round13IntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Round13IntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Round13IntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Round13IntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Round13IntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Round13IntegrationEvent[] { return [...this.events]; }
}
