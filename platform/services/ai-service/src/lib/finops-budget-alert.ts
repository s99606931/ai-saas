// Design Ref: MTU-N110
// Plan SC: FR-N110.1~5

export interface FinopsBudgetAlertConfig { enabled: boolean; namespace: string; version: string; }
export interface FinopsBudgetAlertRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface FinopsBudgetAlertEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface FinopsBudgetAlertStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class FinopsBudgetAlert {
  private rules: FinopsBudgetAlertRule[] = [];
  private events: FinopsBudgetAlertEvent[] = [];
  validateConfig(c: FinopsBudgetAlertConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: FinopsBudgetAlertRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): FinopsBudgetAlertEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: FinopsBudgetAlertEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): FinopsBudgetAlertStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): FinopsBudgetAlertEvent[] { return [...this.events]; }
}
