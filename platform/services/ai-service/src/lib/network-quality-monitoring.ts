// Design Ref: MTU-N179
// Plan SC: FR-N179.1~5

export interface NetworkQualityMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface NetworkQualityMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface NetworkQualityMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface NetworkQualityMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class NetworkQualityMonitoring {
  private rules: NetworkQualityMonitoringRule[] = [];
  private events: NetworkQualityMonitoringEvent[] = [];
  validateConfig(c: NetworkQualityMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: NetworkQualityMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): NetworkQualityMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: NetworkQualityMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): NetworkQualityMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): NetworkQualityMonitoringEvent[] { return [...this.events]; }
}
