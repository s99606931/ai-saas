// Design Ref: MTU-N92
// Plan SC: FR-N92.1~5

export interface ImmutableInfraProdreadyConfig { enabled: boolean; namespace: string; version: string; }
export interface ImmutableInfraProdreadyRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ImmutableInfraProdreadyEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ImmutableInfraProdreadyStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ImmutableInfraProdready {
  private rules: ImmutableInfraProdreadyRule[] = [];
  private events: ImmutableInfraProdreadyEvent[] = [];
  validateConfig(c: ImmutableInfraProdreadyConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ImmutableInfraProdreadyRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ImmutableInfraProdreadyEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ImmutableInfraProdreadyEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ImmutableInfraProdreadyStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ImmutableInfraProdreadyEvent[] { return [...this.events]; }
}
