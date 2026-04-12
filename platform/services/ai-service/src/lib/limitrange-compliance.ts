// Design Ref: MTU-N196
// Plan SC: FR-N196.1~5

export interface LimitrangeComplianceConfig { enabled: boolean; namespace: string; version: string; }
export interface LimitrangeComplianceRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface LimitrangeComplianceEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface LimitrangeComplianceStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class LimitrangeCompliance {
  private rules: LimitrangeComplianceRule[] = [];
  private events: LimitrangeComplianceEvent[] = [];
  validateConfig(c: LimitrangeComplianceConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: LimitrangeComplianceRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): LimitrangeComplianceEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: LimitrangeComplianceEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): LimitrangeComplianceStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): LimitrangeComplianceEvent[] { return [...this.events]; }
}
