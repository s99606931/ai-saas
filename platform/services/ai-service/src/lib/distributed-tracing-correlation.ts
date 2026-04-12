// Design Ref: MTU-N171
// Plan SC: FR-N171.1~5

export interface DistributedTracingCorrelationConfig { enabled: boolean; namespace: string; version: string; }
export interface DistributedTracingCorrelationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface DistributedTracingCorrelationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface DistributedTracingCorrelationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class DistributedTracingCorrelation {
  private rules: DistributedTracingCorrelationRule[] = [];
  private events: DistributedTracingCorrelationEvent[] = [];
  validateConfig(c: DistributedTracingCorrelationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: DistributedTracingCorrelationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): DistributedTracingCorrelationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: DistributedTracingCorrelationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): DistributedTracingCorrelationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): DistributedTracingCorrelationEvent[] { return [...this.events]; }
}
