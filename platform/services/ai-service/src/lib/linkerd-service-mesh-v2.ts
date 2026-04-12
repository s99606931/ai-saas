// Design Ref: MTU-N114
// Plan SC: FR-N114.1~5

export interface LinkerdServiceMeshV2Config { enabled: boolean; namespace: string; version: string; }
export interface LinkerdServiceMeshV2Rule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface LinkerdServiceMeshV2Event { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface LinkerdServiceMeshV2Status { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class LinkerdServiceMeshV2 {
  private rules: LinkerdServiceMeshV2Rule[] = [];
  private events: LinkerdServiceMeshV2Event[] = [];
  validateConfig(c: LinkerdServiceMeshV2Config): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: LinkerdServiceMeshV2Rule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): LinkerdServiceMeshV2Event {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: LinkerdServiceMeshV2Event = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): LinkerdServiceMeshV2Status { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): LinkerdServiceMeshV2Event[] { return [...this.events]; }
}
