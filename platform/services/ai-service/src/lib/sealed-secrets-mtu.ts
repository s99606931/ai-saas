// Design Ref: MTU-N39
// Plan SC: FR-N39.1~5

export interface SealedSecretsMtuConfig { enabled: boolean; namespace: string; version: string; }
export interface SealedSecretsMtuRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SealedSecretsMtuEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SealedSecretsMtuStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SealedSecretsMtu {
  private rules: SealedSecretsMtuRule[] = [];
  private events: SealedSecretsMtuEvent[] = [];
  validateConfig(c: SealedSecretsMtuConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SealedSecretsMtuRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SealedSecretsMtuEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SealedSecretsMtuEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SealedSecretsMtuStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SealedSecretsMtuEvent[] { return [...this.events]; }
}
