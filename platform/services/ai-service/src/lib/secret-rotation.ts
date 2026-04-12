// Design Ref: MTU-N103
// Plan SC: FR-N103.1~5

export interface SecretRotationConfig { enabled: boolean; namespace: string; version: string; }
export interface SecretRotationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SecretRotationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SecretRotationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SecretRotation {
  private rules: SecretRotationRule[] = [];
  private events: SecretRotationEvent[] = [];
  validateConfig(c: SecretRotationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SecretRotationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SecretRotationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SecretRotationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SecretRotationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SecretRotationEvent[] { return [...this.events]; }
}
