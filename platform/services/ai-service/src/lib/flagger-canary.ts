// Design Ref: MTU-N40
// Plan SC: FR-N40.1~5

export interface FlaggerCanaryConfig { enabled: boolean; namespace: string; version: string; }
export interface FlaggerCanaryRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface FlaggerCanaryEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface FlaggerCanaryStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class FlaggerCanary {
  private rules: FlaggerCanaryRule[] = [];
  private events: FlaggerCanaryEvent[] = [];
  validateConfig(c: FlaggerCanaryConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: FlaggerCanaryRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): FlaggerCanaryEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: FlaggerCanaryEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): FlaggerCanaryStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): FlaggerCanaryEvent[] { return [...this.events]; }
}
