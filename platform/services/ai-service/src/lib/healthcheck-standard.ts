// Design Ref: MTU-N147
// Plan SC: FR-N147.1~5

export interface HealthcheckStandardConfig { enabled: boolean; namespace: string; version: string; }
export interface HealthcheckStandardRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface HealthcheckStandardEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface HealthcheckStandardStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class HealthcheckStandard {
  private rules: HealthcheckStandardRule[] = [];
  private events: HealthcheckStandardEvent[] = [];
  validateConfig(c: HealthcheckStandardConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: HealthcheckStandardRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): HealthcheckStandardEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: HealthcheckStandardEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): HealthcheckStandardStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): HealthcheckStandardEvent[] { return [...this.events]; }
}
