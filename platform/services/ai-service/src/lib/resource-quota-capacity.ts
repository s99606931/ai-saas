// Design Ref: MTU-N76
// Plan SC: FR-N76.1~5

export interface ResourceQuotaCapacityConfig { enabled: boolean; namespace: string; version: string; }
export interface ResourceQuotaCapacityRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ResourceQuotaCapacityEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ResourceQuotaCapacityStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ResourceQuotaCapacity {
  private rules: ResourceQuotaCapacityRule[] = [];
  private events: ResourceQuotaCapacityEvent[] = [];
  validateConfig(c: ResourceQuotaCapacityConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ResourceQuotaCapacityRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ResourceQuotaCapacityEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ResourceQuotaCapacityEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ResourceQuotaCapacityStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ResourceQuotaCapacityEvent[] { return [...this.events]; }
}
