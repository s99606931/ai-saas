// Design Ref: MTU-N65
// Plan SC: FR-N65.1~5

export interface GatewayApiTraefikConfig { enabled: boolean; namespace: string; version: string; }
export interface GatewayApiTraefikRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface GatewayApiTraefikEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface GatewayApiTraefikStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class GatewayApiTraefik {
  private rules: GatewayApiTraefikRule[] = [];
  private events: GatewayApiTraefikEvent[] = [];
  validateConfig(c: GatewayApiTraefikConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: GatewayApiTraefikRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): GatewayApiTraefikEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: GatewayApiTraefikEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): GatewayApiTraefikStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): GatewayApiTraefikEvent[] { return [...this.events]; }
}
