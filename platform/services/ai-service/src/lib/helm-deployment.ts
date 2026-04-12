// Design Ref: MTU-N32
// Plan SC: FR-N32.1~5

export interface HelmDeploymentConfig { enabled: boolean; namespace: string; version: string; }
export interface HelmDeploymentRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface HelmDeploymentEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface HelmDeploymentStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class HelmDeployment {
  private rules: HelmDeploymentRule[] = [];
  private events: HelmDeploymentEvent[] = [];
  validateConfig(c: HelmDeploymentConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: HelmDeploymentRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): HelmDeploymentEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: HelmDeploymentEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): HelmDeploymentStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): HelmDeploymentEvent[] { return [...this.events]; }
}
