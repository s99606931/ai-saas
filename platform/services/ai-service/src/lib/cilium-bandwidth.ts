// Design Ref: MTU-N98
// Plan SC: FR-N98.1~5

export interface CiliumBandwidthConfig { enabled: boolean; namespace: string; version: string; }
export interface CiliumBandwidthRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CiliumBandwidthEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CiliumBandwidthStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CiliumBandwidth {
  private rules: CiliumBandwidthRule[] = [];
  private events: CiliumBandwidthEvent[] = [];
  validateConfig(c: CiliumBandwidthConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CiliumBandwidthRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CiliumBandwidthEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CiliumBandwidthEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CiliumBandwidthStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CiliumBandwidthEvent[] { return [...this.events]; }
}
