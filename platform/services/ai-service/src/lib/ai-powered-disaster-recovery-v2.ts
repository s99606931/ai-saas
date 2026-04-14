// Design Ref: SVC-AI-ADV-R680.design.md — AI기반 재해 복구 자동화 v2
// Plan SC: FR-R680.1~5

export type ImpactLevel = 'CATASTROPHIC' | 'MAJOR' | 'MINOR';
export type RecoveryAction = 'MONITOR' | 'RESTORE' | 'FAILOVER';

interface DRSystem { systemId: string; name: string; tier: 'TIER1' | 'TIER2' | 'TIER3' }
interface Incident {
  incidentId: string;
  systemId: string;
  availabilityLoss: number;
}
interface RecoveryPlan {
  incidentId: string;
  systemId: string;
  level: ImpactLevel;
  action: RecoveryAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const ACTION_RANK: RecoveryAction[] = ['MONITOR', 'RESTORE', 'FAILOVER'];

function rankToAction(rank: number): RecoveryAction {
  const idx = Math.max(0, Math.min(ACTION_RANK.length - 1, rank));
  return ACTION_RANK[idx]!;
}

export class AIPoweredDisasterRecoveryV2 {
  private systems = new Map<string, DRSystem>();
  private plans: RecoveryPlan[] = [];
  private auditLog: AuditEntry[] = [];

  registerSystem(sys: DRSystem): void {
    this.systems.set(sys.systemId, sys);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SYSTEM',
      details: { systemId: sys.systemId, name: sys.name, tier: sys.tier },
    });
  }

  assessIncident(incident: Incident, dataGrade?: string): RecoveryPlan {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const sys = this.systems.get(incident.systemId);
    if (!sys) {
      throw new Error(`UNKNOWN_SYSTEM: ${incident.systemId}`);
    }
    if (incident.availabilityLoss < 0 || incident.availabilityLoss > 1) {
      throw new Error('INVALID_AVAILABILITY_LOSS');
    }

    let level: ImpactLevel;
    let baseRank: number;
    if (incident.availabilityLoss >= 0.8) {
      level = 'CATASTROPHIC';
      baseRank = 2;
    } else if (incident.availabilityLoss >= 0.4) {
      level = 'MAJOR';
      baseRank = 1;
    } else {
      level = 'MINOR';
      baseRank = 0;
    }

    const finalRank = sys.tier === 'TIER1' ? baseRank + 1 : baseRank;
    const action = rankToAction(finalRank);

    const plan: RecoveryPlan = {
      incidentId: incident.incidentId,
      systemId: incident.systemId,
      level,
      action,
    };
    this.plans.push(plan);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ASSESS_INCIDENT',
      details: { incidentId: incident.incidentId, systemId: incident.systemId, level, action },
    });
    return plan;
  }

  getFailoverPlans(): RecoveryPlan[] {
    return this.plans.filter((p) => p.action === 'FAILOVER');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
