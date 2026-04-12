// Design Ref: MTU-N94
// Plan SC: FR-N94.1~5

export interface ReleaseMigrationAutoConfig { enabled: boolean; namespace: string; version: string; }
export interface ReleaseMigrationAutoRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ReleaseMigrationAutoEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ReleaseMigrationAutoStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ReleaseMigrationAuto {
  private rules: ReleaseMigrationAutoRule[] = [];
  private events: ReleaseMigrationAutoEvent[] = [];
  validateConfig(c: ReleaseMigrationAutoConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ReleaseMigrationAutoRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ReleaseMigrationAutoEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ReleaseMigrationAutoEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ReleaseMigrationAutoStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ReleaseMigrationAutoEvent[] { return [...this.events]; }
}
