// Design Ref: MTU-N186
// Plan SC: FR-N186.1~5

export interface StorageIoMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface StorageIoMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface StorageIoMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface StorageIoMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class StorageIoMonitoring {
  private rules: StorageIoMonitoringRule[] = [];
  private events: StorageIoMonitoringEvent[] = [];
  validateConfig(c: StorageIoMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: StorageIoMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): StorageIoMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: StorageIoMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): StorageIoMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): StorageIoMonitoringEvent[] { return [...this.events]; }
}
