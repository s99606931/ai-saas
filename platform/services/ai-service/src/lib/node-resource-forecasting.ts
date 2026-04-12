// Design Ref: MTU-N177
// Plan SC: FR-N177.1~5

export interface NodeResourceForecastingConfig { enabled: boolean; namespace: string; version: string; }
export interface NodeResourceForecastingRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface NodeResourceForecastingEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface NodeResourceForecastingStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class NodeResourceForecasting {
  private rules: NodeResourceForecastingRule[] = [];
  private events: NodeResourceForecastingEvent[] = [];
  validateConfig(c: NodeResourceForecastingConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: NodeResourceForecastingRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): NodeResourceForecastingEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: NodeResourceForecastingEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): NodeResourceForecastingStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): NodeResourceForecastingEvent[] { return [...this.events]; }
}
