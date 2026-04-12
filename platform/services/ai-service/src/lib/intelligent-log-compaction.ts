// Design Ref: MTU-N163
// Plan SC: FR-N163.1~5

export interface IntelligentLogCompactionConfig { enabled: boolean; namespace: string; version: string; }
export interface IntelligentLogCompactionRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface IntelligentLogCompactionEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface IntelligentLogCompactionStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class IntelligentLogCompaction {
  private rules: IntelligentLogCompactionRule[] = [];
  private events: IntelligentLogCompactionEvent[] = [];
  validateConfig(c: IntelligentLogCompactionConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: IntelligentLogCompactionRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): IntelligentLogCompactionEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: IntelligentLogCompactionEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): IntelligentLogCompactionStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): IntelligentLogCompactionEvent[] { return [...this.events]; }
}
