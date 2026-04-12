// Design Ref: MTU-N192
// Plan SC: FR-N192.1~5

export interface RolloutMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface RolloutMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface RolloutMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface RolloutMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class RolloutMonitoring {
  private rules: RolloutMonitoringRule[] = [];
  private events: RolloutMonitoringEvent[] = [];
  validateConfig(c: RolloutMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: RolloutMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): RolloutMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: RolloutMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): RolloutMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): RolloutMonitoringEvent[] { return [...this.events]; }
}
