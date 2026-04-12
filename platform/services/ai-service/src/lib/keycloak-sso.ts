// Design Ref: MTU-N170
// Plan SC: FR-N170.1~5

export interface KeycloakSsoConfig { enabled: boolean; namespace: string; version: string; }
export interface KeycloakSsoRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface KeycloakSsoEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface KeycloakSsoStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class KeycloakSso {
  private rules: KeycloakSsoRule[] = [];
  private events: KeycloakSsoEvent[] = [];
  validateConfig(c: KeycloakSsoConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: KeycloakSsoRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): KeycloakSsoEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: KeycloakSsoEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): KeycloakSsoStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): KeycloakSsoEvent[] { return [...this.events]; }
}
