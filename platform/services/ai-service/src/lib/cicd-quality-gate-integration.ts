// Design Ref: MTU-N133
// Plan SC: FR-N133.1~5

export interface CicdQualityGateIntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface CicdQualityGateIntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CicdQualityGateIntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CicdQualityGateIntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CicdQualityGateIntegration {
  private rules: CicdQualityGateIntegrationRule[] = [];
  private events: CicdQualityGateIntegrationEvent[] = [];
  validateConfig(c: CicdQualityGateIntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CicdQualityGateIntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CicdQualityGateIntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CicdQualityGateIntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CicdQualityGateIntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CicdQualityGateIntegrationEvent[] { return [...this.events]; }
}
