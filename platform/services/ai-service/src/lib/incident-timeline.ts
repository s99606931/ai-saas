// Design Ref: MTU-N128
// Plan SC: FR-N128.1~5

export interface IncidentTimelineConfig { enabled: boolean; namespace: string; version: string; }
export interface IncidentTimelineRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface IncidentTimelineEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface IncidentTimelineStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class IncidentTimeline {
  private rules: IncidentTimelineRule[] = [];
  private events: IncidentTimelineEvent[] = [];
  validateConfig(c: IncidentTimelineConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: IncidentTimelineRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): IncidentTimelineEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: IncidentTimelineEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): IncidentTimelineStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): IncidentTimelineEvent[] { return [...this.events]; }
}
