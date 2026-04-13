// SVC-AI-ADV-R446 공공 에너지 소비 최적화 AI
// Design Ref: SVC-AI-ADV-R446.design.md
// Plan SC: FR-446.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type BuildingUse = 'office' | 'school' | 'hospital';

export interface Building {
  readonly id: string;
  readonly area: number;
  readonly use: BuildingUse;
  readonly kwh: number;
}

export interface OptimizationResult {
  readonly id: string;
  readonly ratio: number;
  readonly status: 'WASTE' | 'NORMAL';
  readonly recommendations: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const BENCHMARK: Record<BuildingUse, number> = {
  office: 100,
  school: 80,
  hospital: 150,
};

export class PublicEnergyOptimizerAI {
  private readonly auditLog: AuditEntry[] = [];

  optimize(
    buildings: readonly Building[],
    grade: DataGrade = 'O',
  ): readonly OptimizationResult[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 에너지 데이터 차단 (N2SF N-05)`);
    }

    const results: OptimizationResult[] = buildings.map((b) => {
      if (!b.id) throw new Error('INVALID_BUILDING_ID');
      if (b.area <= 0) throw new Error(`INVALID_AREA: ${b.id}`);
      if (b.kwh < 0) throw new Error(`INVALID_KWH: ${b.id}`);

      const unit = b.kwh / b.area;
      const base = BENCHMARK[b.use];
      const ratio = Number((unit / base).toFixed(4));
      const status: 'WASTE' | 'NORMAL' = ratio > 1.3 ? 'WASTE' : 'NORMAL';

      const recommendations: string[] = [];
      if (status === 'WASTE') {
        recommendations.push('단열 보강');
        recommendations.push('LED 조명 교체');
        recommendations.push('HVAC 스케줄 최적화');
      }

      return { id: b.id, ratio, status, recommendations };
    });

    this.record('OPTIMIZE', 'fleet', {
      total: buildings.length,
      waste: results.filter((r) => r.status === 'WASTE').length,
    });
    return results;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
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
