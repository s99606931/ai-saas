// Design Ref: MTU-N93
// Plan SC: FR-N93.1~5

export interface EbpfZeroTrustConfig { enabled: boolean; namespace: string; version: string; }
export interface EbpfZeroTrustRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface EbpfZeroTrustEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface EbpfZeroTrustStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class EbpfZeroTrust {
  private rules: EbpfZeroTrustRule[] = [];
  private events: EbpfZeroTrustEvent[] = [];
  validateConfig(c: EbpfZeroTrustConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: EbpfZeroTrustRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): EbpfZeroTrustEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: EbpfZeroTrustEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): EbpfZeroTrustStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): EbpfZeroTrustEvent[] { return [...this.events]; }
}
