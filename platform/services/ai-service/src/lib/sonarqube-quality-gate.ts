// Design Ref: MTU-N105
// Plan SC: FR-N105.1~5

export interface SonarqubeQualityGateConfig { enabled: boolean; namespace: string; version: string; }
export interface SonarqubeQualityGateRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SonarqubeQualityGateEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SonarqubeQualityGateStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SonarqubeQualityGate {
  private rules: SonarqubeQualityGateRule[] = [];
  private events: SonarqubeQualityGateEvent[] = [];
  validateConfig(c: SonarqubeQualityGateConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SonarqubeQualityGateRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SonarqubeQualityGateEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SonarqubeQualityGateEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SonarqubeQualityGateStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SonarqubeQualityGateEvent[] { return [...this.events]; }
}
