// Design Ref: MTU-N84
// Plan SC: FR-N84.1~5

export interface CsapEvidenceCollectionConfig { enabled: boolean; namespace: string; version: string; }
export interface CsapEvidenceCollectionRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface CsapEvidenceCollectionEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface CsapEvidenceCollectionStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class CsapEvidenceCollection {
  private rules: CsapEvidenceCollectionRule[] = [];
  private events: CsapEvidenceCollectionEvent[] = [];
  validateConfig(c: CsapEvidenceCollectionConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: CsapEvidenceCollectionRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): CsapEvidenceCollectionEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: CsapEvidenceCollectionEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): CsapEvidenceCollectionStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): CsapEvidenceCollectionEvent[] { return [...this.events]; }
}
