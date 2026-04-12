// Design Ref: MTU-N134
// Plan SC: FR-N134.1~5

export interface CostOptimizationReportConfig { enabled: boolean; namespace: string; version: string; }
export interface CostOptimizationReportRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CostOptimizationReportEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CostOptimizationReportStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CostOptimizationReport {
  private rules: CostOptimizationReportRule[] = [];
  private events: CostOptimizationReportEvent[] = [];
  validateConfig(c: CostOptimizationReportConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CostOptimizationReportRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CostOptimizationReportEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CostOptimizationReportEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CostOptimizationReportStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CostOptimizationReportEvent[] { return [...this.events]; }
}
