// Design Ref: MTU-N83
// Plan SC: FR-N83.1~5

export interface AnomalyDetectionMtuConfig { enabled: boolean; namespace: string; version: string; }
export interface AnomalyDetectionMtuRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface AnomalyDetectionMtuEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface AnomalyDetectionMtuStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class AnomalyDetectionMtu {
  private rules: AnomalyDetectionMtuRule[] = [];
  private events: AnomalyDetectionMtuEvent[] = [];
  validateConfig(c: AnomalyDetectionMtuConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: AnomalyDetectionMtuRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): AnomalyDetectionMtuEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: AnomalyDetectionMtuEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): AnomalyDetectionMtuStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): AnomalyDetectionMtuEvent[] { return [...this.events]; }
}
