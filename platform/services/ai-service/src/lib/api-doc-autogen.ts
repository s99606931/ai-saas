// Design Ref: MTU-N106
// Plan SC: FR-N106.1~5

export interface ApiDocAutogenConfig { enabled: boolean; namespace: string; version: string; }
export interface ApiDocAutogenRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ApiDocAutogenEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ApiDocAutogenStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ApiDocAutogen {
  private rules: ApiDocAutogenRule[] = [];
  private events: ApiDocAutogenEvent[] = [];
  validateConfig(c: ApiDocAutogenConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ApiDocAutogenRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ApiDocAutogenEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ApiDocAutogenEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ApiDocAutogenStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ApiDocAutogenEvent[] { return [...this.events]; }
}
