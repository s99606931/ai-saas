// Design Ref: MTU-N37
// Plan SC: FR-N37.1~5

export interface SbomGrypePipelineConfig { enabled: boolean; namespace: string; version: string; }
export interface SbomGrypePipelineRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SbomGrypePipelineEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SbomGrypePipelineStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SbomGrypePipeline {
  private rules: SbomGrypePipelineRule[] = [];
  private events: SbomGrypePipelineEvent[] = [];
  validateConfig(c: SbomGrypePipelineConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SbomGrypePipelineRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SbomGrypePipelineEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SbomGrypePipelineEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SbomGrypePipelineStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SbomGrypePipelineEvent[] { return [...this.events]; }
}
