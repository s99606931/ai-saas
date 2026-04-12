// Design Ref: MTU-N80
// Plan SC: FR-N80.1~5

export interface S2c2fFrameworkConfig { enabled: boolean; namespace: string; version: string; }
export interface S2c2fFrameworkRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface S2c2fFrameworkEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface S2c2fFrameworkStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class S2c2fFramework {
  private rules: S2c2fFrameworkRule[] = [];
  private events: S2c2fFrameworkEvent[] = [];
  validateConfig(c: S2c2fFrameworkConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: S2c2fFrameworkRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): S2c2fFrameworkEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: S2c2fFrameworkEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): S2c2fFrameworkStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): S2c2fFrameworkEvent[] { return [...this.events]; }
}
