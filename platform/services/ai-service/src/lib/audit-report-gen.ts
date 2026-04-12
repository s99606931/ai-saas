// Design Ref: MTU-N85
// Plan SC: FR-N85.1~5

export interface AuditReportGenConfig { enabled: boolean; namespace: string; version: string; }
export interface AuditReportGenRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface AuditReportGenEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface AuditReportGenStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class AuditReportGen {
  private rules: AuditReportGenRule[] = [];
  private events: AuditReportGenEvent[] = [];
  validateConfig(c: AuditReportGenConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: AuditReportGenRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): AuditReportGenEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: AuditReportGenEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): AuditReportGenStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): AuditReportGenEvent[] { return [...this.events]; }
}
