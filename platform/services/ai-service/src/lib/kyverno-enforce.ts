// Design Ref: MTU-N31
// Plan SC: FR-N31.1~5

export interface KyvernoEnforceConfig { enabled: boolean; namespace: string; version: string; }
export interface KyvernoEnforceRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface KyvernoEnforceEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface KyvernoEnforceStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class KyvernoEnforce {
  private rules: KyvernoEnforceRule[] = [];
  private events: KyvernoEnforceEvent[] = [];
  validateConfig(c: KyvernoEnforceConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: KyvernoEnforceRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): KyvernoEnforceEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: KyvernoEnforceEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): KyvernoEnforceStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): KyvernoEnforceEvent[] { return [...this.events]; }
}
