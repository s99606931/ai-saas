// Design Ref: MTU-N115
// Plan SC: FR-N115.1~5

export interface OpenssfScorecardCiConfig { enabled: boolean; namespace: string; version: string; }
export interface OpenssfScorecardCiRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface OpenssfScorecardCiEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface OpenssfScorecardCiStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class OpenssfScorecardCi {
  private rules: OpenssfScorecardCiRule[] = [];
  private events: OpenssfScorecardCiEvent[] = [];
  validateConfig(c: OpenssfScorecardCiConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: OpenssfScorecardCiRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): OpenssfScorecardCiEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: OpenssfScorecardCiEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): OpenssfScorecardCiStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): OpenssfScorecardCiEvent[] { return [...this.events]; }
}
