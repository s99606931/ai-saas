// Design Ref: MTU-N193
// Plan SC: FR-N193.1~5

export interface NodeConditionMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface NodeConditionMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface NodeConditionMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface NodeConditionMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class NodeConditionMonitoring {
  private rules: NodeConditionMonitoringRule[] = [];
  private events: NodeConditionMonitoringEvent[] = [];
  validateConfig(c: NodeConditionMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: NodeConditionMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): NodeConditionMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: NodeConditionMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): NodeConditionMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): NodeConditionMonitoringEvent[] { return [...this.events]; }
}
