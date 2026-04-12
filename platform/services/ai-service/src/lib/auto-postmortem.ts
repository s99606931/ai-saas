// Design Ref: MTU-N117
// Plan SC: FR-N117.1~5

export interface AutoPostmortemConfig { enabled: boolean; namespace: string; version: string; }
export interface AutoPostmortemRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface AutoPostmortemEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface AutoPostmortemStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class AutoPostmortem {
  private rules: AutoPostmortemRule[] = [];
  private events: AutoPostmortemEvent[] = [];
  validateConfig(c: AutoPostmortemConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: AutoPostmortemRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): AutoPostmortemEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: AutoPostmortemEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): AutoPostmortemStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): AutoPostmortemEvent[] { return [...this.events]; }
}
