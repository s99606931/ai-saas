// Design Ref: MTU-N89
// Plan SC: FR-N89.1~5

export interface VictoriametricsStorageConfig { enabled: boolean; namespace: string; version: string; }
export interface VictoriametricsStorageRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface VictoriametricsStorageEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface VictoriametricsStorageStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class VictoriametricsStorage {
  private rules: VictoriametricsStorageRule[] = [];
  private events: VictoriametricsStorageEvent[] = [];
  validateConfig(c: VictoriametricsStorageConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: VictoriametricsStorageRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): VictoriametricsStorageEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: VictoriametricsStorageEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): VictoriametricsStorageStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): VictoriametricsStorageEvent[] { return [...this.events]; }
}
