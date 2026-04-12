// Design Ref: MTU-N168
// Plan SC: FR-N168.1~5

export interface Round14IntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface Round14IntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Round14IntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Round14IntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Round14Integration {
  private rules: Round14IntegrationRule[] = [];
  private events: Round14IntegrationEvent[] = [];
  validateConfig(c: Round14IntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Round14IntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Round14IntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Round14IntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Round14IntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Round14IntegrationEvent[] { return [...this.events]; }
}
