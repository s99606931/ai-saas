// Design Ref: MTU-N226
// Plan SC: FR-N226.1~5

export interface CertmanagerLifecycleConfig { enabled: boolean; namespace: string; version: string; }
export interface CertmanagerLifecycleRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CertmanagerLifecycleEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CertmanagerLifecycleStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CertmanagerLifecycle {
  private rules: CertmanagerLifecycleRule[] = [];
  private events: CertmanagerLifecycleEvent[] = [];
  validateConfig(c: CertmanagerLifecycleConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CertmanagerLifecycleRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CertmanagerLifecycleEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CertmanagerLifecycleEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CertmanagerLifecycleStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CertmanagerLifecycleEvent[] { return [...this.events]; }
}
