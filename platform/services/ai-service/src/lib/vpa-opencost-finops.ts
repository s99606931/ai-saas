// Design Ref: MTU-N72
// Plan SC: FR-N72.1~5

export interface VpaOpencostFinopsConfig { enabled: boolean; namespace: string; version: string; }
export interface VpaOpencostFinopsRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface VpaOpencostFinopsEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface VpaOpencostFinopsStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class VpaOpencostFinops {
  private rules: VpaOpencostFinopsRule[] = [];
  private events: VpaOpencostFinopsEvent[] = [];
  validateConfig(c: VpaOpencostFinopsConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: VpaOpencostFinopsRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): VpaOpencostFinopsEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: VpaOpencostFinopsEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): VpaOpencostFinopsStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): VpaOpencostFinopsEvent[] { return [...this.events]; }
}
