// Design Ref: MTU-N95
// Plan SC: FR-N95.1~5

export interface IncidentClassificationConfig { enabled: boolean; namespace: string; version: string; }
export interface IncidentClassificationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface IncidentClassificationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface IncidentClassificationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class IncidentClassification {
  private rules: IncidentClassificationRule[] = [];
  private events: IncidentClassificationEvent[] = [];
  validateConfig(c: IncidentClassificationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: IncidentClassificationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): IncidentClassificationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: IncidentClassificationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): IncidentClassificationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): IncidentClassificationEvent[] { return [...this.events]; }
}
