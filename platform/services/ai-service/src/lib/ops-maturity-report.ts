// Design Ref: MTU-N141
// Plan SC: FR-N141.1~5

export interface OpsMaturityReportConfig { enabled: boolean; namespace: string; version: string; }
export interface OpsMaturityReportRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface OpsMaturityReportEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface OpsMaturityReportStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class OpsMaturityReport {
  private rules: OpsMaturityReportRule[] = [];
  private events: OpsMaturityReportEvent[] = [];
  validateConfig(c: OpsMaturityReportConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: OpsMaturityReportRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): OpsMaturityReportEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: OpsMaturityReportEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): OpsMaturityReportStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): OpsMaturityReportEvent[] { return [...this.events]; }
}
