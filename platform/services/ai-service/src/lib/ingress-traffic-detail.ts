// Design Ref: MTU-N223
// Plan SC: FR-N223.1~5

export interface IngressTrafficDetailConfig { enabled: boolean; namespace: string; version: string; }
export interface IngressTrafficDetailRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface IngressTrafficDetailEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface IngressTrafficDetailStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class IngressTrafficDetail {
  private rules: IngressTrafficDetailRule[] = [];
  private events: IngressTrafficDetailEvent[] = [];
  validateConfig(c: IngressTrafficDetailConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: IngressTrafficDetailRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): IngressTrafficDetailEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: IngressTrafficDetailEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): IngressTrafficDetailStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): IngressTrafficDetailEvent[] { return [...this.events]; }
}
