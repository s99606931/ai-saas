// Design Ref: MTU-N229
// Plan SC: FR-N229.1~5

export interface LokiLogPipelineConfig { enabled: boolean; namespace: string; version: string; }
export interface LokiLogPipelineRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface LokiLogPipelineEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface LokiLogPipelineStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class LokiLogPipeline {
  private rules: LokiLogPipelineRule[] = [];
  private events: LokiLogPipelineEvent[] = [];
  validateConfig(c: LokiLogPipelineConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: LokiLogPipelineRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): LokiLogPipelineEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: LokiLogPipelineEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): LokiLogPipelineStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): LokiLogPipelineEvent[] { return [...this.events]; }
}
