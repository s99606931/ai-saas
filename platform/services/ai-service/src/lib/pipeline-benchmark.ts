// Design Ref: MTU-N43
// Plan SC: FR-N43.1~5

export interface PipelineBenchmarkConfig { enabled: boolean; namespace: string; version: string; }
export interface PipelineBenchmarkRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface PipelineBenchmarkEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface PipelineBenchmarkStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class PipelineBenchmark {
  private rules: PipelineBenchmarkRule[] = [];
  private events: PipelineBenchmarkEvent[] = [];
  validateConfig(c: PipelineBenchmarkConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: PipelineBenchmarkRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): PipelineBenchmarkEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: PipelineBenchmarkEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): PipelineBenchmarkStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): PipelineBenchmarkEvent[] { return [...this.events]; }
}
