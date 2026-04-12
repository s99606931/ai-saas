// Design Ref: MTU-N90
// Plan SC: FR-N90.1~5

export interface OpenssfScorecardConfig { enabled: boolean; namespace: string; version: string; }
export interface OpenssfScorecardRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface OpenssfScorecardEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface OpenssfScorecardStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class OpenssfScorecard {
  private rules: OpenssfScorecardRule[] = [];
  private events: OpenssfScorecardEvent[] = [];
  validateConfig(c: OpenssfScorecardConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: OpenssfScorecardRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): OpenssfScorecardEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: OpenssfScorecardEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): OpenssfScorecardStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): OpenssfScorecardEvent[] { return [...this.events]; }
}
