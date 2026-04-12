// Design Ref: MTU-N97
// Plan SC: FR-N97.1~5

export interface StorageTieringConfig { enabled: boolean; namespace: string; version: string; }
export interface StorageTieringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface StorageTieringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface StorageTieringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class StorageTiering {
  private rules: StorageTieringRule[] = [];
  private events: StorageTieringEvent[] = [];
  validateConfig(c: StorageTieringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: StorageTieringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): StorageTieringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: StorageTieringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): StorageTieringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): StorageTieringEvent[] { return [...this.events]; }
}
