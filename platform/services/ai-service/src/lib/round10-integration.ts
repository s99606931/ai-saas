// Design Ref: MTU-N120
// Plan SC: FR-N120.1~5

export interface Round10IntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface Round10IntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Round10IntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Round10IntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Round10Integration {
  private rules: Round10IntegrationRule[] = [];
  private events: Round10IntegrationEvent[] = [];
  validateConfig(c: Round10IntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Round10IntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Round10IntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Round10IntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Round10IntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Round10IntegrationEvent[] { return [...this.events]; }
}
