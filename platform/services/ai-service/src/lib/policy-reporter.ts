// Design Ref: MTU-N34
// Plan SC: FR-N34.1~5

export interface PolicyReporterConfig { enabled: boolean; namespace: string; version: string; }
export interface PolicyReporterRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface PolicyReporterEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface PolicyReporterStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class PolicyReporter {
  private rules: PolicyReporterRule[] = [];
  private events: PolicyReporterEvent[] = [];
  validateConfig(c: PolicyReporterConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: PolicyReporterRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): PolicyReporterEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: PolicyReporterEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): PolicyReporterStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): PolicyReporterEvent[] { return [...this.events]; }
}
