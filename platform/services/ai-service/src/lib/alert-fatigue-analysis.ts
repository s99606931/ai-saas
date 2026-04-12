// Design Ref: MTU-N125
// Plan SC: FR-N125.1~5

export interface AlertFatigueAnalysisConfig { enabled: boolean; namespace: string; version: string; }
export interface AlertFatigueAnalysisRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface AlertFatigueAnalysisEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface AlertFatigueAnalysisStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class AlertFatigueAnalysis {
  private rules: AlertFatigueAnalysisRule[] = [];
  private events: AlertFatigueAnalysisEvent[] = [];
  validateConfig(c: AlertFatigueAnalysisConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: AlertFatigueAnalysisRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): AlertFatigueAnalysisEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: AlertFatigueAnalysisEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): AlertFatigueAnalysisStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): AlertFatigueAnalysisEvent[] { return [...this.events]; }
}
