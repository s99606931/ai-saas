// Design Ref: MTU-N182
// Plan SC: FR-N182.1~5

export interface IngressTrafficMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface IngressTrafficMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface IngressTrafficMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface IngressTrafficMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class IngressTrafficMonitoring {
  private rules: IngressTrafficMonitoringRule[] = [];
  private events: IngressTrafficMonitoringEvent[] = [];
  validateConfig(c: IngressTrafficMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: IngressTrafficMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): IngressTrafficMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: IngressTrafficMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): IngressTrafficMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): IngressTrafficMonitoringEvent[] { return [...this.events]; }
}
