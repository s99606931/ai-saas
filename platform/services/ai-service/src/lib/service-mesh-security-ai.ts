// Design Ref: §핵심 알고리즘 — 우선순위 기반 정책 평가 + 이상 트래픽 탐지
// Plan SC: FR-R218.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type SecurityLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type PolicyAction = 'ALLOW' | 'DENY';

interface MeshService {
  id: string;
  name: string;
  securityLevel: SecurityLevel;
}

interface TrafficPolicy {
  id: string;
  fromServiceId: string;
  toServiceId: string;
  action: PolicyAction;
  priority: number;
}

interface TrafficEvent {
  fromServiceId: string;
  toServiceId: string;
  payloadSize: number;
  timestamp: string;
}

interface InspectionResult {
  fromServiceId: string;
  toServiceId: string;
  action: PolicyAction;
  policyId: string | null;
  reason: string;
}

interface AnomalyReport {
  windowMs: number;
  totalEvents: number;
  blockedEvents: number;
  blockedRate: number;
  anomalyDetected: boolean;
  suspiciousPairs: Array<{ from: string; to: string; blockedCount: number }>;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R218.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class ServiceMeshSecurityAI {
  private services = new Map<string, MeshService>();
  private policies: TrafficPolicy[] = [];
  private trafficEvents: TrafficEvent[] = [];
  private inspectionResults: InspectionResult[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R218.1
  registerService(id: string, name: string, securityLevel: SecurityLevel = 'MEDIUM'): void {
    this.services.set(id, { id, name, securityLevel });
    this.log('REGISTER_SERVICE', { id, name, securityLevel });
  }

  // Plan SC: FR-R218.2
  addPolicy(fromServiceId: string, toServiceId: string, action: PolicyAction, priority: number = 100): void {
    const id = `policy-${this.policies.length + 1}`;
    this.policies.push({ id, fromServiceId, toServiceId, action, priority });
    this.log('ADD_POLICY', { fromServiceId, toServiceId, action, priority });
  }

  // Plan SC: FR-R218.3
  inspectTraffic(fromServiceId: string, toServiceId: string, payloadSize: number, grade: DataGrade = DataGrade.O): InspectionResult {
    guardDataGrade(grade);

    const event: TrafficEvent = {
      fromServiceId,
      toServiceId,
      payloadSize,
      timestamp: new Date().toISOString(),
    };
    this.trafficEvents.push(event);

    const sortedPolicies = this.policies
      .filter(p => p.fromServiceId === fromServiceId && p.toServiceId === toServiceId)
      .sort((a, b) => b.priority - a.priority);

    let result: InspectionResult;
    if (sortedPolicies.length > 0) {
      const matched = sortedPolicies[0]!;
      result = {
        fromServiceId,
        toServiceId,
        action: matched.action,
        policyId: matched.id,
        reason: `정책 ${matched.id} 적용 (priority: ${matched.priority})`,
      };
    } else {
      result = {
        fromServiceId,
        toServiceId,
        action: 'ALLOW',
        policyId: null,
        reason: '기본 허용 (정책 없음)',
      };
    }

    this.inspectionResults.push(result);
    this.log('INSPECT_TRAFFIC', { fromServiceId, toServiceId, action: result.action });
    return result;
  }

  // Plan SC: FR-R218.4
  analyzeAnomalies(windowMs: number): AnomalyReport {
    const cutoff = Date.now() - windowMs;
    const recentEvents = this.inspectionResults.filter(
      (_, i) => {
        const ts = new Date(this.trafficEvents[i]?.timestamp ?? 0).getTime();
        return ts >= cutoff;
      }
    );

    const totalEvents = recentEvents.length;
    const blockedEvents = recentEvents.filter(e => e.action === 'DENY').length;
    const blockedRate = totalEvents === 0 ? 0 : blockedEvents / totalEvents;

    const pairBlocked = new Map<string, number>();
    for (const event of recentEvents.filter(e => e.action === 'DENY')) {
      const key = `${event.fromServiceId}→${event.toServiceId}`;
      pairBlocked.set(key, (pairBlocked.get(key) ?? 0) + 1);
    }

    const suspiciousPairs = Array.from(pairBlocked.entries())
      .filter(([, count]) => count >= 3)
      .map(([key, count]) => {
        const [from, to] = key.split('→');
        return { from: from ?? '', to: to ?? '', blockedCount: count };
      });

    this.log('ANALYZE_ANOMALIES', { windowMs, totalEvents, blockedEvents, anomalyDetected: blockedRate > 0.5 });
    return {
      windowMs,
      totalEvents,
      blockedEvents,
      blockedRate: Math.round(blockedRate * 100) / 100,
      anomalyDetected: blockedRate > 0.5,
      suspiciousPairs,
    };
  }

  // Plan SC: FR-R218.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
