// Design Ref: MTU-N97
// Plan SC: FR-N97.1~5

export interface FinopsDashboardConfig { enabled: boolean; namespace: string; version: string; }
export interface FinopsDashboardRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface FinopsDashboardEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface FinopsDashboardStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class FinopsDashboard {
  private rules: FinopsDashboardRule[] = [];
  private events: FinopsDashboardEvent[] = [];
  validateConfig(c: FinopsDashboardConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: FinopsDashboardRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): FinopsDashboardEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: FinopsDashboardEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): FinopsDashboardStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): FinopsDashboardEvent[] { return [...this.events]; }
}
