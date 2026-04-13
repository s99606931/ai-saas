// SVC-AI-ADV-R424 Environmental Impact Assessor
// Design Ref: SVC-AI-ADV-R424.design.md
// Plan SC: FR-424.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ProjectEnv {
  readonly projectId: string;
  readonly emissionsTon: number;
  readonly noiseDb: number;
  readonly wastewaterTon: number;
}

export interface ImpactResult {
  readonly projectId: string;
  readonly ghgScore: number;
  readonly noiseScore: number;
  readonly waterScore: number;
  readonly totalImpact: number;
  readonly grade: Grade;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

function clip(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export class EnvironmentalImpactAssessor {
  private readonly auditLog: AuditEntry[] = [];

  assess(project: ProjectEnv, grade: DataGrade = 'O'): ImpactResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 환경 데이터 차단 (N2SF N-05)`);
    }
    if (project.emissionsTon < 0 || project.noiseDb < 0 || project.wastewaterTon < 0) {
      throw new Error('INVALID_NEGATIVE');
    }

    const ghgScore = Number(clip(project.emissionsTon * 2, 0, 100).toFixed(2));
    const noiseScore = Number(clip((project.noiseDb - 40) * 2, 0, 100).toFixed(2));
    const waterScore = Number(clip(project.wastewaterTon * 5, 0, 100).toFixed(2));
    const totalImpact = Number((ghgScore * 0.5 + noiseScore * 0.2 + waterScore * 0.3).toFixed(2));

    let g: Grade;
    if (totalImpact < 20) g = 'A';
    else if (totalImpact < 40) g = 'B';
    else if (totalImpact < 60) g = 'C';
    else if (totalImpact < 80) g = 'D';
    else g = 'E';

    this.record('ASSESS', project.projectId, { totalImpact, grade: g });
    return {
      projectId: project.projectId,
      ghgScore,
      noiseScore,
      waterScore,
      totalImpact,
      grade: g,
    };
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
