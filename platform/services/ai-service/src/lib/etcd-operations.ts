// Design Ref: MTU-N222
// Plan SC: FR-N222.1~5

export interface EtcdOperationsConfig { enabled: boolean; namespace: string; version: string; }
export interface EtcdOperationsRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface EtcdOperationsEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface EtcdOperationsStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class EtcdOperations {
  private rules: EtcdOperationsRule[] = [];
  private events: EtcdOperationsEvent[] = [];
  validateConfig(c: EtcdOperationsConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: EtcdOperationsRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): EtcdOperationsEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: EtcdOperationsEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): EtcdOperationsStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): EtcdOperationsEvent[] { return [...this.events]; }
}
