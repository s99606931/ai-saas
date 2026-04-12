// Design Ref: MTU-N35b
// Plan SC: FR-N35b.1~5

export interface HelmUmbrellaConfig { enabled: boolean; namespace: string; version: string; }
export interface HelmUmbrellaRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface HelmUmbrellaEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface HelmUmbrellaStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class HelmUmbrella {
  private rules: HelmUmbrellaRule[] = [];
  private events: HelmUmbrellaEvent[] = [];
  validateConfig(c: HelmUmbrellaConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: HelmUmbrellaRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): HelmUmbrellaEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: HelmUmbrellaEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): HelmUmbrellaStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): HelmUmbrellaEvent[] { return [...this.events]; }
}
