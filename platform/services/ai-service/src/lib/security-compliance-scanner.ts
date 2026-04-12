// Design Ref: MTU-N131
// Plan SC: FR-N131.1~5

export interface SecurityComplianceScannerConfig { enabled: boolean; namespace: string; version: string; }
export interface SecurityComplianceScannerRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SecurityComplianceScannerEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SecurityComplianceScannerStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SecurityComplianceScanner {
  private rules: SecurityComplianceScannerRule[] = [];
  private events: SecurityComplianceScannerEvent[] = [];
  validateConfig(c: SecurityComplianceScannerConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SecurityComplianceScannerRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SecurityComplianceScannerEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SecurityComplianceScannerEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SecurityComplianceScannerStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SecurityComplianceScannerEvent[] { return [...this.events]; }
}
