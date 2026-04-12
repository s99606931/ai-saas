// Design Ref: MTU-N183
// Plan SC: FR-N183.1~5

export interface K8sJobCronjobMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface K8sJobCronjobMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface K8sJobCronjobMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface K8sJobCronjobMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class K8sJobCronjobMonitoring {
  private rules: K8sJobCronjobMonitoringRule[] = [];
  private events: K8sJobCronjobMonitoringEvent[] = [];
  validateConfig(c: K8sJobCronjobMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: K8sJobCronjobMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): K8sJobCronjobMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: K8sJobCronjobMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): K8sJobCronjobMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): K8sJobCronjobMonitoringEvent[] { return [...this.events]; }
}
