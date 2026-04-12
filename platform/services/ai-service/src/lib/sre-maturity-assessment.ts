// Design Ref: MTU-N127
// Plan SC: FR-N127.1~5

export interface SreMaturityAssessmentConfig { enabled: boolean; namespace: string; version: string; }
export interface SreMaturityAssessmentRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SreMaturityAssessmentEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SreMaturityAssessmentStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SreMaturityAssessment {
  private rules: SreMaturityAssessmentRule[] = [];
  private events: SreMaturityAssessmentEvent[] = [];
  validateConfig(c: SreMaturityAssessmentConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SreMaturityAssessmentRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SreMaturityAssessmentEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SreMaturityAssessmentEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SreMaturityAssessmentStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SreMaturityAssessmentEvent[] { return [...this.events]; }
}
