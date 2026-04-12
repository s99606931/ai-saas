// Design Ref: MTU-N227
// Plan SC: FR-N227.1~5

export interface SealedExternalMgmtConfig { enabled: boolean; namespace: string; version: string; }
export interface SealedExternalMgmtRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface SealedExternalMgmtEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface SealedExternalMgmtStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class SealedExternalMgmt {
  private rules: SealedExternalMgmtRule[] = [];
  private events: SealedExternalMgmtEvent[] = [];
  validateConfig(c: SealedExternalMgmtConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: SealedExternalMgmtRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): SealedExternalMgmtEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: SealedExternalMgmtEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): SealedExternalMgmtStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): SealedExternalMgmtEvent[] { return [...this.events]; }
}
