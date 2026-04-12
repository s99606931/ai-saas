// Design Ref: MTU-N130
// Plan SC: FR-N130.1~5

export interface TechDebtDashboardConfig { enabled: boolean; namespace: string; version: string; }
export interface TechDebtDashboardRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface TechDebtDashboardEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface TechDebtDashboardStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class TechDebtDashboard {
  private rules: TechDebtDashboardRule[] = [];
  private events: TechDebtDashboardEvent[] = [];
  validateConfig(c: TechDebtDashboardConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: TechDebtDashboardRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): TechDebtDashboardEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: TechDebtDashboardEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): TechDebtDashboardStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): TechDebtDashboardEvent[] { return [...this.events]; }
}
