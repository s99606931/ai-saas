// Design Ref: MTU-N179
// Plan SC: FR-N179.1~5

export interface UnifiedAuditTrailConfig { enabled: boolean; namespace: string; version: string; }
export interface UnifiedAuditTrailRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface UnifiedAuditTrailEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface UnifiedAuditTrailStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class UnifiedAuditTrail {
  private rules: UnifiedAuditTrailRule[] = [];
  private events: UnifiedAuditTrailEvent[] = [];
  validateConfig(c: UnifiedAuditTrailConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: UnifiedAuditTrailRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): UnifiedAuditTrailEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: UnifiedAuditTrailEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): UnifiedAuditTrailStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): UnifiedAuditTrailEvent[] { return [...this.events]; }
}
