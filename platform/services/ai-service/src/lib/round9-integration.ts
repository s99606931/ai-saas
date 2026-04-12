// Design Ref: MTU-N112
// Plan SC: FR-N112.1~5

export interface Round9IntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface Round9IntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Round9IntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Round9IntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Round9Integration {
  private rules: Round9IntegrationRule[] = [];
  private events: Round9IntegrationEvent[] = [];
  validateConfig(c: Round9IntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Round9IntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Round9IntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Round9IntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Round9IntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Round9IntegrationEvent[] { return [...this.events]; }
}
