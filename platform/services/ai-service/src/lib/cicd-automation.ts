// Design Ref: MTU-N35
// Plan SC: FR-N35.1~5

export interface CicdAutomationConfig { enabled: boolean; namespace: string; version: string; }
export interface CicdAutomationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CicdAutomationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CicdAutomationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CicdAutomation {
  private rules: CicdAutomationRule[] = [];
  private events: CicdAutomationEvent[] = [];
  validateConfig(c: CicdAutomationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CicdAutomationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CicdAutomationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CicdAutomationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CicdAutomationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CicdAutomationEvent[] { return [...this.events]; }
}
