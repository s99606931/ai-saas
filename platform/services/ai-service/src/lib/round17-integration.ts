// Design Ref: MTU-N184
// Plan SC: FR-N184.1~5

export interface Round17IntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface Round17IntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Round17IntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Round17IntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Round17Integration {
  private rules: Round17IntegrationRule[] = [];
  private events: Round17IntegrationEvent[] = [];
  validateConfig(c: Round17IntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Round17IntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Round17IntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Round17IntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Round17IntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Round17IntegrationEvent[] { return [...this.events]; }
}
