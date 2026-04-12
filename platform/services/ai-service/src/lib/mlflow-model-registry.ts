// Design Ref: MTU-N173
// Plan SC: FR-N173.1~5

export interface MlflowModelRegistryConfig { enabled: boolean; namespace: string; version: string; }
export interface MlflowModelRegistryRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface MlflowModelRegistryEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface MlflowModelRegistryStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class MlflowModelRegistry {
  private rules: MlflowModelRegistryRule[] = [];
  private events: MlflowModelRegistryEvent[] = [];
  validateConfig(c: MlflowModelRegistryConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: MlflowModelRegistryRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): MlflowModelRegistryEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: MlflowModelRegistryEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): MlflowModelRegistryStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): MlflowModelRegistryEvent[] { return [...this.events]; }
}
