// Design Ref: MTU-N235
// Plan SC: FR-N235.1~5

export interface LdapAdIntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface LdapAdIntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface LdapAdIntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface LdapAdIntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class LdapAdIntegration {
  private rules: LdapAdIntegrationRule[] = [];
  private events: LdapAdIntegrationEvent[] = [];
  validateConfig(c: LdapAdIntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: LdapAdIntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): LdapAdIntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: LdapAdIntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): LdapAdIntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): LdapAdIntegrationEvent[] { return [...this.events]; }
}
