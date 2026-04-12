// Design Ref: MTU-N81
// Plan SC: FR-N81.1~5

export interface VulnAutoPatchConfig { enabled: boolean; namespace: string; version: string; }
export interface VulnAutoPatchRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface VulnAutoPatchEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface VulnAutoPatchStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class VulnAutoPatch {
  private rules: VulnAutoPatchRule[] = [];
  private events: VulnAutoPatchEvent[] = [];
  validateConfig(c: VulnAutoPatchConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: VulnAutoPatchRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): VulnAutoPatchEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: VulnAutoPatchEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): VulnAutoPatchStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): VulnAutoPatchEvent[] { return [...this.events]; }
}
