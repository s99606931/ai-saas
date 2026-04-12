// Design Ref: MTU-N100
// Plan SC: FR-N100.1~5

export interface BackstageIdpConfig { enabled: boolean; namespace: string; version: string; }
export interface BackstageIdpRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface BackstageIdpEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface BackstageIdpStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class BackstageIdp {
  private rules: BackstageIdpRule[] = [];
  private events: BackstageIdpEvent[] = [];
  validateConfig(c: BackstageIdpConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: BackstageIdpRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): BackstageIdpEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: BackstageIdpEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): BackstageIdpStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): BackstageIdpEvent[] { return [...this.events]; }
}
