// Design Ref: MTU-N194
// Plan SC: FR-N194.1~5

export interface PvcLifecycleConfig { enabled: boolean; namespace: string; version: string; }
export interface PvcLifecycleRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface PvcLifecycleEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface PvcLifecycleStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class PvcLifecycle {
  private rules: PvcLifecycleRule[] = [];
  private events: PvcLifecycleEvent[] = [];
  validateConfig(c: PvcLifecycleConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: PvcLifecycleRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): PvcLifecycleEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: PvcLifecycleEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): PvcLifecycleStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): PvcLifecycleEvent[] { return [...this.events]; }
}
