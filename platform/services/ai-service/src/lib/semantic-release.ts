// Design Ref: MTU-N42
// Plan SC: FR-N42.1~5

export interface SemanticReleaseConfig { enabled: boolean; namespace: string; version: string; }
export interface SemanticReleaseRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SemanticReleaseEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SemanticReleaseStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SemanticRelease {
  private rules: SemanticReleaseRule[] = [];
  private events: SemanticReleaseEvent[] = [];
  validateConfig(c: SemanticReleaseConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SemanticReleaseRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SemanticReleaseEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SemanticReleaseEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SemanticReleaseStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SemanticReleaseEvent[] { return [...this.events]; }
}
