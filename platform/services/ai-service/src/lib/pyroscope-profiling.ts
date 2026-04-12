// Design Ref: MTU-N82
// Plan SC: FR-N82.1~5

export interface PyroscopeProfilingConfig { enabled: boolean; namespace: string; version: string; }
export interface PyroscopeProfilingRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface PyroscopeProfilingEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface PyroscopeProfilingStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class PyroscopeProfiling {
  private rules: PyroscopeProfilingRule[] = [];
  private events: PyroscopeProfilingEvent[] = [];
  validateConfig(c: PyroscopeProfilingConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: PyroscopeProfilingRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): PyroscopeProfilingEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: PyroscopeProfilingEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): PyroscopeProfilingStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): PyroscopeProfilingEvent[] { return [...this.events]; }
}
