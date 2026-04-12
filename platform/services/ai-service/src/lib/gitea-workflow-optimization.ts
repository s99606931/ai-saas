// Design Ref: MTU-N38
// Plan SC: FR-N38.1~5

export interface GiteaWorkflowOptimizationConfig { enabled: boolean; namespace: string; version: string; }
export interface GiteaWorkflowOptimizationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface GiteaWorkflowOptimizationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface GiteaWorkflowOptimizationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class GiteaWorkflowOptimization {
  private rules: GiteaWorkflowOptimizationRule[] = [];
  private events: GiteaWorkflowOptimizationEvent[] = [];
  validateConfig(c: GiteaWorkflowOptimizationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: GiteaWorkflowOptimizationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): GiteaWorkflowOptimizationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: GiteaWorkflowOptimizationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): GiteaWorkflowOptimizationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): GiteaWorkflowOptimizationEvent[] { return [...this.events]; }
}
