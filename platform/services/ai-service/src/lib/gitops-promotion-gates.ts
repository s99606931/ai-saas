// Design Ref: MTU-N172
// Plan SC: FR-N172.1~5

export interface GitopsPromotionGatesConfig { enabled: boolean; namespace: string; version: string; }
export interface GitopsPromotionGatesRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface GitopsPromotionGatesEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface GitopsPromotionGatesStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class GitopsPromotionGates {
  private rules: GitopsPromotionGatesRule[] = [];
  private events: GitopsPromotionGatesEvent[] = [];
  validateConfig(c: GitopsPromotionGatesConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: GitopsPromotionGatesRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): GitopsPromotionGatesEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: GitopsPromotionGatesEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): GitopsPromotionGatesStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): GitopsPromotionGatesEvent[] { return [...this.events]; }
}
