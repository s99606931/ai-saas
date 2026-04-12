// Design Ref: MTU-N139
// Plan SC: FR-N139.1~5

export interface DrSimulationConfig { enabled: boolean; namespace: string; version: string; }
export interface DrSimulationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface DrSimulationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface DrSimulationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class DrSimulation {
  private rules: DrSimulationRule[] = [];
  private events: DrSimulationEvent[] = [];
  validateConfig(c: DrSimulationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: DrSimulationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): DrSimulationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: DrSimulationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): DrSimulationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): DrSimulationEvent[] { return [...this.events]; }
}
