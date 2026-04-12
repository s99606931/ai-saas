// Design Ref: MTU-N167
// Plan SC: FR-N167.1~5

export interface SlaContractManagementConfig { enabled: boolean; namespace: string; version: string; }
export interface SlaContractManagementRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SlaContractManagementEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SlaContractManagementStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SlaContractManagement {
  private rules: SlaContractManagementRule[] = [];
  private events: SlaContractManagementEvent[] = [];
  validateConfig(c: SlaContractManagementConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SlaContractManagementRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SlaContractManagementEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SlaContractManagementEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SlaContractManagementStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SlaContractManagementEvent[] { return [...this.events]; }
}
