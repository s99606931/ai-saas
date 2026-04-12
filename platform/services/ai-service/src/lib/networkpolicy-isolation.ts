// Design Ref: MTU-N28b
// Plan SC: FR-N28b.1~5

export interface NetworkpolicyIsolationConfig { enabled: boolean; namespace: string; version: string; }
export interface NetworkpolicyIsolationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface NetworkpolicyIsolationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface NetworkpolicyIsolationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class NetworkpolicyIsolation {
  private rules: NetworkpolicyIsolationRule[] = [];
  private events: NetworkpolicyIsolationEvent[] = [];
  validateConfig(c: NetworkpolicyIsolationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: NetworkpolicyIsolationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): NetworkpolicyIsolationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: NetworkpolicyIsolationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): NetworkpolicyIsolationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): NetworkpolicyIsolationEvent[] { return [...this.events]; }
}
