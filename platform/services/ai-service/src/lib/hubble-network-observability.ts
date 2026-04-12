// Design Ref: MTU-N176
// Plan SC: FR-N176.1~5

export interface HubbleNetworkObservabilityConfig { enabled: boolean; namespace: string; version: string; }
export interface HubbleNetworkObservabilityRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface HubbleNetworkObservabilityEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface HubbleNetworkObservabilityStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class HubbleNetworkObservability {
  private rules: HubbleNetworkObservabilityRule[] = [];
  private events: HubbleNetworkObservabilityEvent[] = [];
  validateConfig(c: HubbleNetworkObservabilityConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: HubbleNetworkObservabilityRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): HubbleNetworkObservabilityEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: HubbleNetworkObservabilityEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): HubbleNetworkObservabilityStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): HubbleNetworkObservabilityEvent[] { return [...this.events]; }
}
