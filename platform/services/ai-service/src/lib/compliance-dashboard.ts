// Design Ref: MTU-N144
// Plan SC: FR-N144.1~5

export interface ComplianceDashboardConfig { enabled: boolean; namespace: string; version: string; }
export interface ComplianceDashboardRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ComplianceDashboardEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ComplianceDashboardStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ComplianceDashboard {
  private rules: ComplianceDashboardRule[] = [];
  private events: ComplianceDashboardEvent[] = [];
  validateConfig(c: ComplianceDashboardConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ComplianceDashboardRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ComplianceDashboardEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ComplianceDashboardEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ComplianceDashboardStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ComplianceDashboardEvent[] { return [...this.events]; }
}
