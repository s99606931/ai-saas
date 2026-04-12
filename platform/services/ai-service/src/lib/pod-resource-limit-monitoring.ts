// Design Ref: MTU-N189
// Plan SC: FR-N189.1~5

export interface PodResourceLimitMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface PodResourceLimitMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface PodResourceLimitMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface PodResourceLimitMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class PodResourceLimitMonitoring {
  private rules: PodResourceLimitMonitoringRule[] = [];
  private events: PodResourceLimitMonitoringEvent[] = [];
  validateConfig(c: PodResourceLimitMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: PodResourceLimitMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): PodResourceLimitMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: PodResourceLimitMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): PodResourceLimitMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): PodResourceLimitMonitoringEvent[] { return [...this.events]; }
}
