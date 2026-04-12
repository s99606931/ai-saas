// Design Ref: MTU-N98
// Plan SC: FR-N98.1~5

export interface MonitoringE2eTestConfig { enabled: boolean; namespace: string; version: string; }
export interface MonitoringE2eTestRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface MonitoringE2eTestEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface MonitoringE2eTestStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class MonitoringE2eTest {
  private rules: MonitoringE2eTestRule[] = [];
  private events: MonitoringE2eTestEvent[] = [];
  validateConfig(c: MonitoringE2eTestConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: MonitoringE2eTestRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): MonitoringE2eTestEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: MonitoringE2eTestEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): MonitoringE2eTestStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): MonitoringE2eTestEvent[] { return [...this.events]; }
}
