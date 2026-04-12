// Design Ref: MTU-N113
// Plan SC: FR-N113.1~5

export interface KedaEventAutoscaleConfig { enabled: boolean; namespace: string; version: string; }
export interface KedaEventAutoscaleRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface KedaEventAutoscaleEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface KedaEventAutoscaleStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class KedaEventAutoscale {
  private rules: KedaEventAutoscaleRule[] = [];
  private events: KedaEventAutoscaleEvent[] = [];
  validateConfig(c: KedaEventAutoscaleConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: KedaEventAutoscaleRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): KedaEventAutoscaleEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: KedaEventAutoscaleEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): KedaEventAutoscaleStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): KedaEventAutoscaleEvent[] { return [...this.events]; }
}
