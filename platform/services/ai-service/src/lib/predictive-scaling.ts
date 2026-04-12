// Design Ref: MTU-N93
// Plan SC: FR-N93.1~5

export interface PredictiveScalingConfig { enabled: boolean; namespace: string; version: string; }
export interface PredictiveScalingRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface PredictiveScalingEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface PredictiveScalingStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class PredictiveScaling {
  private rules: PredictiveScalingRule[] = [];
  private events: PredictiveScalingEvent[] = [];
  validateConfig(c: PredictiveScalingConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: PredictiveScalingRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): PredictiveScalingEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: PredictiveScalingEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): PredictiveScalingStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): PredictiveScalingEvent[] { return [...this.events]; }
}
