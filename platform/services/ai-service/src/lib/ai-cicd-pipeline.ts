// Design Ref: MTU-N77
// Plan SC: FR-N77.1~5

export interface AiCicdPipelineConfig { enabled: boolean; namespace: string; version: string; }
export interface AiCicdPipelineRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface AiCicdPipelineEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface AiCicdPipelineStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class AiCicdPipeline {
  private rules: AiCicdPipelineRule[] = [];
  private events: AiCicdPipelineEvent[] = [];
  validateConfig(c: AiCicdPipelineConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: AiCicdPipelineRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): AiCicdPipelineEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: AiCicdPipelineEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): AiCicdPipelineStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): AiCicdPipelineEvent[] { return [...this.events]; }
}
