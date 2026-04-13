// SVC-AI-ADV-R437 Urban Plan Impact Analyzer AI
// Design Ref: SVC-AI-ADV-R437.design.md
// Plan SC: FR-437.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Impact = 'LOW' | 'MEDIUM' | 'HIGH';

export interface UrbanPlan {
  readonly planId: string;
  readonly heightMeters: number;
  readonly expectedVehicles: number;
  readonly constructionMonths: number;
  readonly distanceToNearestBuilding: number;
}

export interface ImpactEntry {
  readonly score: number;
  readonly level: Impact;
}

export interface ImpactReport {
  readonly planId: string;
  readonly traffic: ImpactEntry;
  readonly noise: ImpactEntry;
  readonly sunlight: ImpactEntry;
  readonly recommendations: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class UrbanPlanImpactAnalyzerAI {
  private readonly auditLog: AuditEntry[] = [];

  analyze(plan: UrbanPlan, grade: DataGrade = 'O'): ImpactReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 계획 데이터 차단 (N2SF N-05)`);
    }
    if (plan.heightMeters < 0 || plan.expectedVehicles < 0 || plan.constructionMonths < 0) {
      throw new Error('INVALID_INPUT: negative value');
    }

    const trafficScore = Number(Math.min(1, 0.01 * plan.expectedVehicles).toFixed(4));
    const noiseScore = Number(
      Math.min(1, 0.05 * plan.heightMeters + 0.3 * (plan.constructionMonths / 12)).toFixed(4),
    );
    const sunlightScore = Number(
      Math.min(1, plan.heightMeters / (plan.distanceToNearestBuilding + 1) / 10).toFixed(4),
    );

    const traffic = { score: trafficScore, level: this.level(trafficScore) };
    const noise = { score: noiseScore, level: this.level(noiseScore) };
    const sunlight = { score: sunlightScore, level: this.level(sunlightScore) };

    const recs: string[] = [];
    if (traffic.level === 'HIGH') recs.push('교통 영향 평가 재검토 및 신호체계 개선');
    if (noise.level === 'HIGH') recs.push('방음벽 설치 및 공사 시간 제한');
    if (sunlight.level === 'HIGH') recs.push('일조권 분쟁 조정 및 층수 조정 검토');
    if (recs.length === 0) recs.push('경미한 영향 — 통상 승인 절차 진행');

    this.record('ANALYZE', plan.planId, { traffic, noise, sunlight });
    return { planId: plan.planId, traffic, noise, sunlight, recommendations: recs };
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private level(score: number): Impact {
    if (score > 0.7) return 'HIGH';
    if (score >= 0.3) return 'MEDIUM';
    return 'LOW';
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
