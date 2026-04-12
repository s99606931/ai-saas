// Design Ref: MTU-N140
// Plan SC: FR-N140.1~5

export interface DepSecurityAuditConfig { enabled: boolean; namespace: string; version: string; }
export interface DepSecurityAuditRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface DepSecurityAuditEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface DepSecurityAuditStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class DepSecurityAudit {
  private rules: DepSecurityAuditRule[] = [];
  private events: DepSecurityAuditEvent[] = [];
  validateConfig(c: DepSecurityAuditConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: DepSecurityAuditRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): DepSecurityAuditEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: DepSecurityAuditEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): DepSecurityAuditStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): DepSecurityAuditEvent[] { return [...this.events]; }
}
