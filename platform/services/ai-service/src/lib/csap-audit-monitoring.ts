// Design Ref: MTU-N99
// Plan SC: FR-N99.1~5

export interface CsapAuditMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface CsapAuditMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CsapAuditMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CsapAuditMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CsapAuditMonitoring {
  private rules: CsapAuditMonitoringRule[] = [];
  private events: CsapAuditMonitoringEvent[] = [];
  validateConfig(c: CsapAuditMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CsapAuditMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CsapAuditMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CsapAuditMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CsapAuditMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CsapAuditMonitoringEvent[] { return [...this.events]; }
}
