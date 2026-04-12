// Design Ref: MTU-N166
// Plan SC: FR-N166.1~5

export interface TenantQuotaAutotuneConfig { enabled: boolean; namespace: string; version: string; }
export interface TenantQuotaAutotuneRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface TenantQuotaAutotuneEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface TenantQuotaAutotuneStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class TenantQuotaAutotune {
  private rules: TenantQuotaAutotuneRule[] = [];
  private events: TenantQuotaAutotuneEvent[] = [];
  validateConfig(c: TenantQuotaAutotuneConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: TenantQuotaAutotuneRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): TenantQuotaAutotuneEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: TenantQuotaAutotuneEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): TenantQuotaAutotuneStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): TenantQuotaAutotuneEvent[] { return [...this.events]; }
}
