// Design Ref: MTU-N27
// Plan SC: FR-N27.1~5

export interface CosignImageSigningConfig { enabled: boolean; namespace: string; version: string; }
export interface CosignImageSigningRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CosignImageSigningEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CosignImageSigningStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CosignImageSigning {
  private rules: CosignImageSigningRule[] = [];
  private events: CosignImageSigningEvent[] = [];
  validateConfig(c: CosignImageSigningConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CosignImageSigningRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CosignImageSigningEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CosignImageSigningEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CosignImageSigningStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CosignImageSigningEvent[] { return [...this.events]; }
}
