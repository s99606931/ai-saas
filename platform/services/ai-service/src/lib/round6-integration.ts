// Design Ref: MTU-N88
// Plan SC: FR-N88.1~5

export interface Round6IntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface Round6IntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Round6IntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Round6IntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Round6Integration {
  private rules: Round6IntegrationRule[] = [];
  private events: Round6IntegrationEvent[] = [];
  validateConfig(c: Round6IntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Round6IntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Round6IntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Round6IntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Round6IntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Round6IntegrationEvent[] { return [...this.events]; }
}
