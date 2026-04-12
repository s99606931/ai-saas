// Design Ref: MTU-N146
// Plan SC: FR-N146.1~5

export interface ObservabilityMaturityConfig { enabled: boolean; namespace: string; version: string; }
export interface ObservabilityMaturityRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ObservabilityMaturityEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ObservabilityMaturityStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ObservabilityMaturity {
  private rules: ObservabilityMaturityRule[] = [];
  private events: ObservabilityMaturityEvent[] = [];
  validateConfig(c: ObservabilityMaturityConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ObservabilityMaturityRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ObservabilityMaturityEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ObservabilityMaturityEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ObservabilityMaturityStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ObservabilityMaturityEvent[] { return [...this.events]; }
}
