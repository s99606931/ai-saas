// Design Ref: MTU-N174
// Plan SC: FR-N174.1~5

export interface DnsResolutionMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface DnsResolutionMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface DnsResolutionMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface DnsResolutionMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class DnsResolutionMonitoring {
  private rules: DnsResolutionMonitoringRule[] = [];
  private events: DnsResolutionMonitoringEvent[] = [];
  validateConfig(c: DnsResolutionMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: DnsResolutionMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): DnsResolutionMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: DnsResolutionMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): DnsResolutionMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): DnsResolutionMonitoringEvent[] { return [...this.events]; }
}
