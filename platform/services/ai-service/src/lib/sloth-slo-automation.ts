// Design Ref: MTU-N49 §SLO/SLI 자동화
// Plan SC: FR-N49.1~5

export interface SlothSloAutomationConfig {
  enabled: boolean;
  namespace: string;
  version: string;
}

export interface SlothSloAutomationRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'log';
}

export interface SlothSloAutomationEvent {
  ruleId: string;
  actor: string;
  resource: string;
  at: string;
  severity: string;
}

export interface SlothSloAutomationStatus {
  healthy: boolean;
  rulesLoaded: number;
  eventsProcessed: number;
}

export class SlothSloAutomation {
  private rules: SlothSloAutomationRule[] = [];
  private events: SlothSloAutomationEvent[] = [];

  /** FR-N49.1.1 설정 검증 */
  validateConfig(config: SlothSloAutomationConfig): boolean {
    if (!config.namespace || !config.version) return false;
    return config.enabled;
  }

  /** FR-N49.1.2 규칙 등록 */
  registerRule(rule: SlothSloAutomationRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule: ${rule.id}`);
    }
    this.rules.push(rule);
  }

  /** FR-N49.1.3 이벤트 평가 */
  evaluate(actor: string, resource: string, ruleId: string): SlothSloAutomationEvent {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    const event: SlothSloAutomationEvent = {
      ruleId,
      actor,
      resource,
      at: new Date().toISOString(),
      severity: rule.severity,
    };
    this.events.push(event);
    return event;
  }

  /** FR-N49.1.4 상태 조회 */
  getStatus(): SlothSloAutomationStatus {
    return {
      healthy: this.rules.length > 0,
      rulesLoaded: this.rules.length,
      eventsProcessed: this.events.length,
    };
  }

  /** FR-N49.1.5 감사 로그 (CSAP D-06) */
  getAuditLog(): SlothSloAutomationEvent[] {
    return [...this.events];
  }
}

export const sloth_slo_automation = new SlothSloAutomation();
