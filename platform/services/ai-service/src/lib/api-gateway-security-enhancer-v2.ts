// Design Ref: §SVC-AI-ADV-R516 — AI기반 API 게이트웨이 보안 강화 v2
// Plan SC: FR-R516.1~5

export type AnomalyType = 'RATE_ABUSE' | 'ERROR_STORM' | 'IP_SWEEP' | 'NORMAL';
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type GatewayPolicy = 'BLOCK' | 'THROTTLE' | 'ALLOW';

export interface ApiRequest {
  readonly clientId: string;
  readonly endpoint: string;
  readonly requestsPerMin: number;
  readonly errorRate: number;
  readonly uniqueIPs: number;
}

export interface SecurityAnalysis {
  readonly clientId: string;
  readonly anomalies: readonly AnomalyType[];
  readonly riskLevel: RiskLevel;
  readonly policy: GatewayPolicy;
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class ApiGatewaySecurityEnhancerV2 {
  private readonly auditLog: AuditEvent[] = [];

  analyze(requests: readonly ApiRequest[]): readonly SecurityAnalysis[] {
    const results: SecurityAnalysis[] = requests.map(req => {
      const anomalies: AnomalyType[] = [];
      if (req.requestsPerMin > 1000) anomalies.push('RATE_ABUSE');
      if (req.errorRate > 0.3) anomalies.push('ERROR_STORM');
      if (req.uniqueIPs > 500) anomalies.push('IP_SWEEP');
      if (anomalies.length === 0) anomalies.push('NORMAL');

      const riskLevel: RiskLevel =
        anomalies.includes('RATE_ABUSE') || anomalies.includes('IP_SWEEP')
          ? 'HIGH'
          : anomalies.includes('ERROR_STORM')
          ? 'MEDIUM'
          : 'LOW';

      const policy: GatewayPolicy =
        riskLevel === 'HIGH' ? 'BLOCK' : riskLevel === 'MEDIUM' ? 'THROTTLE' : 'ALLOW';

      return { clientId: req.clientId, anomalies, riskLevel, policy };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'gateway.analyze',
      details: {
        requestCount: requests.length,
        blockedCount: results.filter(r => r.policy === 'BLOCK').length,
        highRiskCount: results.filter(r => r.riskLevel === 'HIGH').length,
      },
    });

    return results;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
