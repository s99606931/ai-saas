// Design Ref: MTU-N29
// Plan SC: FR-N29.1~5

export interface E2eScenarioTestConfig { enabled: boolean; namespace: string; version: string; }
export interface E2eScenarioTestRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface E2eScenarioTestEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface E2eScenarioTestStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class E2eScenarioTest {
  private rules: E2eScenarioTestRule[] = [];
  private events: E2eScenarioTestEvent[] = [];
  validateConfig(c: E2eScenarioTestConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: E2eScenarioTestRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): E2eScenarioTestEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: E2eScenarioTestEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): E2eScenarioTestStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): E2eScenarioTestEvent[] { return [...this.events]; }
}
