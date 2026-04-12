// Design Ref: MTU-N221
// Plan SC: FR-N221.1~5

export interface HarborRegistryPerfConfig { enabled: boolean; namespace: string; version: string; }
export interface HarborRegistryPerfRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface HarborRegistryPerfEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface HarborRegistryPerfStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class HarborRegistryPerf {
  private rules: HarborRegistryPerfRule[] = [];
  private events: HarborRegistryPerfEvent[] = [];
  validateConfig(c: HarborRegistryPerfConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: HarborRegistryPerfRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): HarborRegistryPerfEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: HarborRegistryPerfEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): HarborRegistryPerfStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): HarborRegistryPerfEvent[] { return [...this.events]; }
}
