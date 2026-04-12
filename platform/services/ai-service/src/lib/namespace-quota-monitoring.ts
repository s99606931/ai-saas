// Design Ref: MTU-N191
// Plan SC: FR-N191.1~5

export interface NamespaceQuotaMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface NamespaceQuotaMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface NamespaceQuotaMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface NamespaceQuotaMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class NamespaceQuotaMonitoring {
  private rules: NamespaceQuotaMonitoringRule[] = [];
  private events: NamespaceQuotaMonitoringEvent[] = [];
  validateConfig(c: NamespaceQuotaMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: NamespaceQuotaMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): NamespaceQuotaMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: NamespaceQuotaMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): NamespaceQuotaMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): NamespaceQuotaMonitoringEvent[] { return [...this.events]; }
}
