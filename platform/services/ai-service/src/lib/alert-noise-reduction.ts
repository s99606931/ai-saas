// Design Ref: MTU-N91
// Plan SC: FR-N91.1~5

export interface AlertNoiseReductionConfig { enabled: boolean; namespace: string; version: string; }
export interface AlertNoiseReductionRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface AlertNoiseReductionEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface AlertNoiseReductionStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class AlertNoiseReduction {
  private rules: AlertNoiseReductionRule[] = [];
  private events: AlertNoiseReductionEvent[] = [];
  validateConfig(c: AlertNoiseReductionConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: AlertNoiseReductionRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): AlertNoiseReductionEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: AlertNoiseReductionEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): AlertNoiseReductionStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): AlertNoiseReductionEvent[] { return [...this.events]; }
}
