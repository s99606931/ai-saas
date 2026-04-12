// Design Ref: MTU-N91
// Plan SC: FR-N91.1~5

export interface SemgrepQualityGateConfig { enabled: boolean; namespace: string; version: string; }
export interface SemgrepQualityGateRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SemgrepQualityGateEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SemgrepQualityGateStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SemgrepQualityGate {
  private rules: SemgrepQualityGateRule[] = [];
  private events: SemgrepQualityGateEvent[] = [];
  validateConfig(c: SemgrepQualityGateConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SemgrepQualityGateRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SemgrepQualityGateEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SemgrepQualityGateEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SemgrepQualityGateStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SemgrepQualityGateEvent[] { return [...this.events]; }
}
