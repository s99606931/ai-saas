// Design Ref: MTU-N28
// Plan SC: FR-N28.1~5

export interface K3sCicdMigrationConfig { enabled: boolean; namespace: string; version: string; }
export interface K3sCicdMigrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface K3sCicdMigrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface K3sCicdMigrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class K3sCicdMigration {
  private rules: K3sCicdMigrationRule[] = [];
  private events: K3sCicdMigrationEvent[] = [];
  validateConfig(c: K3sCicdMigrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: K3sCicdMigrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): K3sCicdMigrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: K3sCicdMigrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): K3sCicdMigrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): K3sCicdMigrationEvent[] { return [...this.events]; }
}
