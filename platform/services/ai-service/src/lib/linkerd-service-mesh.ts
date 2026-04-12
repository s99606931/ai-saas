// Design Ref: MTU-N54 §Linkerd mTLS 메시
// Plan SC: FR-N54.1~5

export interface LinkerdServiceMeshConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface LinkerdServiceMeshRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface LinkerdServiceMeshEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface LinkerdServiceMeshStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class LinkerdServiceMesh {
  private rules: LinkerdServiceMeshRule[] = [];
  private events: LinkerdServiceMeshEvent[] = [];

  /** FR-N54.1.1 설정 검증 */
  validateConfig(config: LinkerdServiceMeshConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  /** FR-N54.1.2 규칙 등록 */
  registerRule(rule: LinkerdServiceMeshRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  /** FR-N54.1.3 이벤트 평가 */
  evaluate(actor: string, resource: string, ruleId: string): LinkerdServiceMeshEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: LinkerdServiceMeshEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  /** FR-N54.1.4 상태 조회 */
  getStatus(): LinkerdServiceMeshStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  /** FR-N54.1.5 감사 로그 (CSAP D-06) */
  getAuditLog(): LinkerdServiceMeshEvent[] {
    return [...this.events];
  }
}

export const linkerd_service_mesh = new LinkerdServiceMesh();
