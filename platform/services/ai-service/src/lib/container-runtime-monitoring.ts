// Design Ref: MTU-N180
// Plan SC: FR-N180.1~5

export interface ContainerRuntimeMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface ContainerRuntimeMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ContainerRuntimeMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ContainerRuntimeMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ContainerRuntimeMonitoring {
  private rules: ContainerRuntimeMonitoringRule[] = [];
  private events: ContainerRuntimeMonitoringEvent[] = [];
  validateConfig(c: ContainerRuntimeMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ContainerRuntimeMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ContainerRuntimeMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ContainerRuntimeMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ContainerRuntimeMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ContainerRuntimeMonitoringEvent[] { return [...this.events]; }
}
