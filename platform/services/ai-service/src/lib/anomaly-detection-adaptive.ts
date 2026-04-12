// Design Ref: MTU-N92
// Plan SC: FR-N92.1~5

export interface AnomalyDetectionAdaptiveConfig { enabled: boolean; namespace: string; version: string; }
export interface AnomalyDetectionAdaptiveRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface AnomalyDetectionAdaptiveEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface AnomalyDetectionAdaptiveStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class AnomalyDetectionAdaptive {
  private rules: AnomalyDetectionAdaptiveRule[] = [];
  private events: AnomalyDetectionAdaptiveEvent[] = [];
  validateConfig(c: AnomalyDetectionAdaptiveConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: AnomalyDetectionAdaptiveRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): AnomalyDetectionAdaptiveEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: AnomalyDetectionAdaptiveEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): AnomalyDetectionAdaptiveStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): AnomalyDetectionAdaptiveEvent[] { return [...this.events]; }
}
