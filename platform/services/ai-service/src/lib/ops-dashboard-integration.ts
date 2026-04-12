// Design Ref: MTU-N132
// Plan SC: FR-N132.1~5

export interface OpsDashboardIntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface OpsDashboardIntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface OpsDashboardIntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface OpsDashboardIntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class OpsDashboardIntegration {
  private rules: OpsDashboardIntegrationRule[] = [];
  private events: OpsDashboardIntegrationEvent[] = [];
  validateConfig(c: OpsDashboardIntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: OpsDashboardIntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): OpsDashboardIntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: OpsDashboardIntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): OpsDashboardIntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): OpsDashboardIntegrationEvent[] { return [...this.events]; }
}
