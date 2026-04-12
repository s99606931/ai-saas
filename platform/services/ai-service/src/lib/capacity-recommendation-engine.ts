// Design Ref: MTU-N161
// Plan SC: FR-N161.1~5

export interface CapacityRecommendationEngineConfig { enabled: boolean; namespace: string; version: string; }
export interface CapacityRecommendationEngineRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CapacityRecommendationEngineEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CapacityRecommendationEngineStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CapacityRecommendationEngine {
  private rules: CapacityRecommendationEngineRule[] = [];
  private events: CapacityRecommendationEngineEvent[] = [];
  validateConfig(c: CapacityRecommendationEngineConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CapacityRecommendationEngineRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CapacityRecommendationEngineEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CapacityRecommendationEngineEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CapacityRecommendationEngineStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CapacityRecommendationEngineEvent[] { return [...this.events]; }
}
