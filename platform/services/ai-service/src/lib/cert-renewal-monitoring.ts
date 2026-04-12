// Design Ref: MTU-N169
// Plan SC: FR-N169.1~5

export interface CertRenewalMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface CertRenewalMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CertRenewalMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CertRenewalMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CertRenewalMonitoring {
  private rules: CertRenewalMonitoringRule[] = [];
  private events: CertRenewalMonitoringEvent[] = [];
  validateConfig(c: CertRenewalMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CertRenewalMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CertRenewalMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CertRenewalMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CertRenewalMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CertRenewalMonitoringEvent[] { return [...this.events]; }
}
