// Design Ref: MTU-N198
// Plan SC: FR-N198.1~5

export interface EndpointAvailabilityConfig { enabled: boolean; namespace: string; version: string; }
export interface EndpointAvailabilityRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface EndpointAvailabilityEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface EndpointAvailabilityStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class EndpointAvailability {
  private rules: EndpointAvailabilityRule[] = [];
  private events: EndpointAvailabilityEvent[] = [];
  validateConfig(c: EndpointAvailabilityConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: EndpointAvailabilityRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): EndpointAvailabilityEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: EndpointAvailabilityEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): EndpointAvailabilityStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): EndpointAvailabilityEvent[] { return [...this.events]; }
}
