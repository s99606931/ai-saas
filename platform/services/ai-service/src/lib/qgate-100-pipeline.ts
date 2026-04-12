// Design Ref: MTU-N95
// Plan SC: FR-N95.1~5

export interface Qgate100PipelineConfig { enabled: boolean; namespace: string; version: string; }
export interface Qgate100PipelineRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface Qgate100PipelineEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface Qgate100PipelineStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class Qgate100Pipeline {
  private rules: Qgate100PipelineRule[] = [];
  private events: Qgate100PipelineEvent[] = [];
  validateConfig(c: Qgate100PipelineConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: Qgate100PipelineRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): Qgate100PipelineEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: Qgate100PipelineEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): Qgate100PipelineStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): Qgate100PipelineEvent[] { return [...this.events]; }
}
