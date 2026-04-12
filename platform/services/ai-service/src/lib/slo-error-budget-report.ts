// Design Ref: MTU-N121
// Plan SC: FR-N121.1~5

export interface SloErrorBudgetReportConfig { enabled: boolean; namespace: string; version: string; }
export interface SloErrorBudgetReportRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SloErrorBudgetReportEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SloErrorBudgetReportStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SloErrorBudgetReport {
  private rules: SloErrorBudgetReportRule[] = [];
  private events: SloErrorBudgetReportEvent[] = [];
  validateConfig(c: SloErrorBudgetReportConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SloErrorBudgetReportRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SloErrorBudgetReportEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SloErrorBudgetReportEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SloErrorBudgetReportStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SloErrorBudgetReportEvent[] { return [...this.events]; }
}
