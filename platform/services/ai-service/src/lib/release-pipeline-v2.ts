// Design Ref: MTU-N118
// Plan SC: FR-N118.1~5

export interface ReleasePipelineV2Config { enabled: boolean; namespace: string; version: string; }
export interface ReleasePipelineV2Rule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ReleasePipelineV2Event { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ReleasePipelineV2Status { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ReleasePipelineV2 {
  private rules: ReleasePipelineV2Rule[] = [];
  private events: ReleasePipelineV2Event[] = [];
  validateConfig(c: ReleasePipelineV2Config): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ReleasePipelineV2Rule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ReleasePipelineV2Event {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ReleasePipelineV2Event = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ReleasePipelineV2Status { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ReleasePipelineV2Event[] { return [...this.events]; }
}
