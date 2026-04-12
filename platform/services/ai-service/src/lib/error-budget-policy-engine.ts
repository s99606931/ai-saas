// Design Ref: MTU-N145
// Plan SC: FR-N145.1~5

export interface ErrorBudgetPolicyEngineConfig { enabled: boolean; namespace: string; version: string; }
export interface ErrorBudgetPolicyEngineRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ErrorBudgetPolicyEngineEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ErrorBudgetPolicyEngineStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ErrorBudgetPolicyEngine {
  private rules: ErrorBudgetPolicyEngineRule[] = [];
  private events: ErrorBudgetPolicyEngineEvent[] = [];
  validateConfig(c: ErrorBudgetPolicyEngineConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ErrorBudgetPolicyEngineRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ErrorBudgetPolicyEngineEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ErrorBudgetPolicyEngineEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ErrorBudgetPolicyEngineStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ErrorBudgetPolicyEngineEvent[] { return [...this.events]; }
}
