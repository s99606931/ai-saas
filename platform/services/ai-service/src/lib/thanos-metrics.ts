// Design Ref: MTU-N102
// Plan SC: FR-N102.1~5

export interface ThanosMetricsConfig { enabled: boolean; namespace: string; version: string; }
export interface ThanosMetricsRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ThanosMetricsEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ThanosMetricsStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ThanosMetrics {
  private rules: ThanosMetricsRule[] = [];
  private events: ThanosMetricsEvent[] = [];
  validateConfig(c: ThanosMetricsConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ThanosMetricsRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ThanosMetricsEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ThanosMetricsEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ThanosMetricsStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ThanosMetricsEvent[] { return [...this.events]; }
}
