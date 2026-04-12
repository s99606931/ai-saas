// Design Ref: MTU-N104
// Plan SC: FR-N104.1~5

export interface Round8IntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface Round8IntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Round8IntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Round8IntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Round8Integration {
  private rules: Round8IntegrationRule[] = [];
  private events: Round8IntegrationEvent[] = [];
  validateConfig(c: Round8IntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Round8IntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Round8IntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Round8IntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Round8IntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Round8IntegrationEvent[] { return [...this.events]; }
}
