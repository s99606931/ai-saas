// Design Ref: MTU-N116
// Plan SC: FR-N116.1~5

export interface ChatopsIntegrationConfig { enabled: boolean; namespace: string; version: string; }
export interface ChatopsIntegrationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ChatopsIntegrationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ChatopsIntegrationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ChatopsIntegration {
  private rules: ChatopsIntegrationRule[] = [];
  private events: ChatopsIntegrationEvent[] = [];
  validateConfig(c: ChatopsIntegrationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ChatopsIntegrationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ChatopsIntegrationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ChatopsIntegrationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ChatopsIntegrationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ChatopsIntegrationEvent[] { return [...this.events]; }
}
