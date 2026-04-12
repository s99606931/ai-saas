// Design Ref: MTU-N136
// Plan SC: FR-N136.1~5

export interface ChangeManagementAutomationConfig { enabled: boolean; namespace: string; version: string; }
export interface ChangeManagementAutomationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ChangeManagementAutomationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ChangeManagementAutomationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ChangeManagementAutomation {
  private rules: ChangeManagementAutomationRule[] = [];
  private events: ChangeManagementAutomationEvent[] = [];
  validateConfig(c: ChangeManagementAutomationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ChangeManagementAutomationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ChangeManagementAutomationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ChangeManagementAutomationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ChangeManagementAutomationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ChangeManagementAutomationEvent[] { return [...this.events]; }
}
