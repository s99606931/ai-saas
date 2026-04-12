// Design Ref: MTU-N73
// Plan SC: FR-N73.1~5

export interface VclusterPrPreviewConfig { enabled: boolean; namespace: string; version: string; }
export interface VclusterPrPreviewRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface VclusterPrPreviewEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface VclusterPrPreviewStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class VclusterPrPreview {
  private rules: VclusterPrPreviewRule[] = [];
  private events: VclusterPrPreviewEvent[] = [];
  validateConfig(c: VclusterPrPreviewConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: VclusterPrPreviewRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): VclusterPrPreviewEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: VclusterPrPreviewEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): VclusterPrPreviewStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): VclusterPrPreviewEvent[] { return [...this.events]; }
}
