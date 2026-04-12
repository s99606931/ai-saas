// Design Ref: MTU-N160
// Plan SC: FR-N160.1~5

export interface CostAttributionDashboardConfig { enabled: boolean; namespace: string; version: string; }
export interface CostAttributionDashboardRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CostAttributionDashboardEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CostAttributionDashboardStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CostAttributionDashboard {
  private rules: CostAttributionDashboardRule[] = [];
  private events: CostAttributionDashboardEvent[] = [];
  validateConfig(c: CostAttributionDashboardConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CostAttributionDashboardRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CostAttributionDashboardEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CostAttributionDashboardEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CostAttributionDashboardStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CostAttributionDashboardEvent[] { return [...this.events]; }
}
