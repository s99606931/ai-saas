// Design Ref: MTU-N228
// Plan SC: FR-N228.1~5

export interface Round23IntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface Round23IntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Round23IntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Round23IntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Round23Integration {
  private rules: Round23IntegrationRule[] = [];
  private events: Round23IntegrationEvent[] = [];
  validateConfig(c: Round23IntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Round23IntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Round23IntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Round23IntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Round23IntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Round23IntegrationEvent[] { return [...this.events]; }
}
