// Design Ref: MTU-N135
// Plan SC: FR-N135.1~5

export interface CapacityForecastConfig { enabled: boolean; namespace: string; version: string; }
export interface CapacityForecastRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CapacityForecastEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CapacityForecastStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CapacityForecast {
  private rules: CapacityForecastRule[] = [];
  private events: CapacityForecastEvent[] = [];
  validateConfig(c: CapacityForecastConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CapacityForecastRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CapacityForecastEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CapacityForecastEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CapacityForecastStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CapacityForecastEvent[] { return [...this.events]; }
}
