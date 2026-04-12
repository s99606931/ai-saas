// Design Ref: MTU-N185
// Plan SC: FR-N185.1~5

export interface HpaVpaAutoscalingMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface HpaVpaAutoscalingMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface HpaVpaAutoscalingMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface HpaVpaAutoscalingMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class HpaVpaAutoscalingMonitoring {
  private rules: HpaVpaAutoscalingMonitoringRule[] = [];
  private events: HpaVpaAutoscalingMonitoringEvent[] = [];
  validateConfig(c: HpaVpaAutoscalingMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: HpaVpaAutoscalingMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): HpaVpaAutoscalingMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: HpaVpaAutoscalingMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): HpaVpaAutoscalingMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): HpaVpaAutoscalingMonitoringEvent[] { return [...this.events]; }
}
