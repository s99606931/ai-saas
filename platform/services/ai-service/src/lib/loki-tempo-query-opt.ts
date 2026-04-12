// Design Ref: MTU-N69
// Plan SC: FR-N69.1~5

export interface LokiTempoQueryOptConfig { enabled: boolean; namespace: string; version: string; }
export interface LokiTempoQueryOptRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface LokiTempoQueryOptEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface LokiTempoQueryOptStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class LokiTempoQueryOpt {
  private rules: LokiTempoQueryOptRule[] = [];
  private events: LokiTempoQueryOptEvent[] = [];
  validateConfig(c: LokiTempoQueryOptConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: LokiTempoQueryOptRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): LokiTempoQueryOptEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: LokiTempoQueryOptEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): LokiTempoQueryOptStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): LokiTempoQueryOptEvent[] { return [...this.events]; }
}
