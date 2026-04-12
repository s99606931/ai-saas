// Design Ref: MTU-N177
// Plan SC: FR-N177.1~5

export interface TechDebtMeasurementConfig { enabled: boolean; namespace: string; version: string; }
export interface TechDebtMeasurementRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface TechDebtMeasurementEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface TechDebtMeasurementStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class TechDebtMeasurement {
  private rules: TechDebtMeasurementRule[] = [];
  private events: TechDebtMeasurementEvent[] = [];
  validateConfig(c: TechDebtMeasurementConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: TechDebtMeasurementRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): TechDebtMeasurementEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: TechDebtMeasurementEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): TechDebtMeasurementStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): TechDebtMeasurementEvent[] { return [...this.events]; }
}
