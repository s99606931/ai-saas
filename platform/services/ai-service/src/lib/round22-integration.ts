// Design Ref: MTU-N218
// Plan SC: FR-N218.1~5

export interface Round22IntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface Round22IntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Round22IntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Round22IntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Round22Integration {
  private rules: Round22IntegrationRule[] = [];
  private events: Round22IntegrationEvent[] = [];
  validateConfig(c: Round22IntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Round22IntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Round22IntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Round22IntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Round22IntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Round22IntegrationEvent[] { return [...this.events]; }
}
