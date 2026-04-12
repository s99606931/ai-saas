// Design Ref: MTU-N70
// Plan SC: FR-N70.1~5

export interface MonitoringE2eErrorBudgetConfig { enabled: boolean; namespace: string; version: string; }
export interface MonitoringE2eErrorBudgetRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface MonitoringE2eErrorBudgetEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface MonitoringE2eErrorBudgetStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class MonitoringE2eErrorBudget {
  private rules: MonitoringE2eErrorBudgetRule[] = [];
  private events: MonitoringE2eErrorBudgetEvent[] = [];
  validateConfig(c: MonitoringE2eErrorBudgetConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: MonitoringE2eErrorBudgetRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): MonitoringE2eErrorBudgetEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: MonitoringE2eErrorBudgetEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): MonitoringE2eErrorBudgetStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): MonitoringE2eErrorBudgetEvent[] { return [...this.events]; }
}
