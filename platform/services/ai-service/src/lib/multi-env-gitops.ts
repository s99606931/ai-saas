// Design Ref: MTU-N41
// Plan SC: FR-N41.1~5

export interface MultiEnvGitopsConfig { enabled: boolean; namespace: string; version: string; }
export interface MultiEnvGitopsRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface MultiEnvGitopsEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface MultiEnvGitopsStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class MultiEnvGitops {
  private rules: MultiEnvGitopsRule[] = [];
  private events: MultiEnvGitopsEvent[] = [];
  validateConfig(c: MultiEnvGitopsConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: MultiEnvGitopsRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): MultiEnvGitopsEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: MultiEnvGitopsEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): MultiEnvGitopsStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): MultiEnvGitopsEvent[] { return [...this.events]; }
}
