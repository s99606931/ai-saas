// Design Ref: MTU-N170
// Plan SC: FR-N170.1~5

export interface ServiceCatalogMetadataConfig { enabled: boolean; namespace: string; version: string; }
export interface ServiceCatalogMetadataRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ServiceCatalogMetadataEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ServiceCatalogMetadataStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ServiceCatalogMetadata {
  private rules: ServiceCatalogMetadataRule[] = [];
  private events: ServiceCatalogMetadataEvent[] = [];
  validateConfig(c: ServiceCatalogMetadataConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ServiceCatalogMetadataRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ServiceCatalogMetadataEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ServiceCatalogMetadataEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ServiceCatalogMetadataStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ServiceCatalogMetadataEvent[] { return [...this.events]; }
}
