// Design Ref: MTU-N199
// Plan SC: FR-N199.1~5

export interface PdbComplianceConfig { enabled: boolean; namespace: string; version: string; }
export interface PdbComplianceRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface PdbComplianceEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface PdbComplianceStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class PdbCompliance {
  private rules: PdbComplianceRule[] = [];
  private events: PdbComplianceEvent[] = [];
  validateConfig(c: PdbComplianceConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: PdbComplianceRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): PdbComplianceEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: PdbComplianceEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): PdbComplianceStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): PdbComplianceEvent[] { return [...this.events]; }
}
