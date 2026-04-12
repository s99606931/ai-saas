// Design Ref: MTU-N67
// Plan SC: FR-N67.1~5

export interface FluxConfigmapAuditConfig { enabled: boolean; namespace: string; version: string; }
export interface FluxConfigmapAuditRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface FluxConfigmapAuditEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface FluxConfigmapAuditStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class FluxConfigmapAudit {
  private rules: FluxConfigmapAuditRule[] = [];
  private events: FluxConfigmapAuditEvent[] = [];
  validateConfig(c: FluxConfigmapAuditConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: FluxConfigmapAuditRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): FluxConfigmapAuditEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: FluxConfigmapAuditEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): FluxConfigmapAuditStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): FluxConfigmapAuditEvent[] { return [...this.events]; }
}
