// Design Ref: MTU-N99
// Plan SC: FR-N99.1~5

export interface CrossplaneIacConfig { enabled: boolean; namespace: string; version: string; }
export interface CrossplaneIacRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CrossplaneIacEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CrossplaneIacStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CrossplaneIac {
  private rules: CrossplaneIacRule[] = [];
  private events: CrossplaneIacEvent[] = [];
  validateConfig(c: CrossplaneIacConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CrossplaneIacRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CrossplaneIacEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CrossplaneIacEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CrossplaneIacStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CrossplaneIacEvent[] { return [...this.events]; }
}
