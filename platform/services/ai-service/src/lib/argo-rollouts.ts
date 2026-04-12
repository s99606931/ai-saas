// Design Ref: MTU-N101
// Plan SC: FR-N101.1~5

export interface ArgoRolloutsConfig { enabled: boolean; namespace: string; version: string; }
export interface ArgoRolloutsRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ArgoRolloutsEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ArgoRolloutsStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ArgoRollouts {
  private rules: ArgoRolloutsRule[] = [];
  private events: ArgoRolloutsEvent[] = [];
  validateConfig(c: ArgoRolloutsConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ArgoRolloutsRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ArgoRolloutsEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ArgoRolloutsEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ArgoRolloutsStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ArgoRolloutsEvent[] { return [...this.events]; }
}
