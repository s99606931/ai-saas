// Design Ref: MTU-N159
// Plan SC: FR-N159.1~5

export interface TopologyAwareRoutingConfig { enabled: boolean; namespace: string; version: string; }
export interface TopologyAwareRoutingRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface TopologyAwareRoutingEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface TopologyAwareRoutingStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class TopologyAwareRouting {
  private rules: TopologyAwareRoutingRule[] = [];
  private events: TopologyAwareRoutingEvent[] = [];
  validateConfig(c: TopologyAwareRoutingConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: TopologyAwareRoutingRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): TopologyAwareRoutingEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: TopologyAwareRoutingEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): TopologyAwareRoutingStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): TopologyAwareRoutingEvent[] { return [...this.events]; }
}
