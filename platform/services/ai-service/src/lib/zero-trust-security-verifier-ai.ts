// Design Ref: §핵심 알고리즘 — 컨텍스트 신뢰 점수 감산 모델
// Plan SC: FR-R285.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type EntityType = 'user' | 'device' | 'service';

interface EntityRecord {
  id: string;
  type: EntityType;
  baseTrustScore: number;
  currentTrustScore: number;
  trustThreshold: number;
}

interface AccessContext {
  location: 'known' | 'unknown';
  device: 'known' | 'unknown';
  timeOfDay: 'business_hours' | 'off_hours';
}

interface VerificationResult {
  allowed: boolean;
  trustScore: number;
  reason: string;
}

interface AnomalyEvent {
  entityId: string;
  reason: string;
  trustScoreAtTime: number;
  recordedAt: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R285.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class ZeroTrustSecurityVerifierAI {
  private entities = new Map<string, EntityRecord>();
  private anomalies: AnomalyEvent[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R285.1
  registerEntity(id: string, type: EntityType, baseTrustScore: number, trustThreshold: number = 60): void {
    this.entities.set(id, { id, type, baseTrustScore, currentTrustScore: baseTrustScore, trustThreshold });
    this.log('REGISTER_ENTITY', { id, type, baseTrustScore, trustThreshold });
  }

  // Plan SC: FR-R285.2 + R285.3
  verify(entityId: string, context: AccessContext, grade: DataGrade = DataGrade.O): VerificationResult {
    guardDataGrade(grade);
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`엔티티 미등록: ${entityId}`);

    let trustScore = entity.baseTrustScore;
    if (context.location === 'unknown') trustScore -= 20;
    if (context.device === 'unknown') trustScore -= 15;
    if (context.timeOfDay === 'off_hours') trustScore -= 10;
    trustScore = Math.max(0, Math.min(100, trustScore));

    entity.currentTrustScore = trustScore;
    const allowed = trustScore >= entity.trustThreshold;

    // Plan SC: FR-R285.4
    if (!allowed) {
      this.anomalies.push({
        entityId,
        reason: `신뢰 점수 임계값 미달 (${trustScore} < ${entity.trustThreshold})`,
        trustScoreAtTime: trustScore,
        recordedAt: new Date().toISOString(),
      });
    }

    this.log('VERIFY', { entityId, trustScore, allowed });
    return {
      allowed,
      trustScore,
      reason: allowed ? `신뢰 점수 충족 (${trustScore} >= ${entity.trustThreshold})` : `신뢰 점수 미달 (${trustScore} < ${entity.trustThreshold})`,
    };
  }

  getTrustScore(entityId: string): number {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`엔티티 미등록: ${entityId}`);
    return entity.currentTrustScore;
  }

  getAnomalyEvents(entityId?: string): AnomalyEvent[] {
    if (entityId) return this.anomalies.filter(a => a.entityId === entityId);
    return [...this.anomalies];
  }

  // Plan SC: FR-R285.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
