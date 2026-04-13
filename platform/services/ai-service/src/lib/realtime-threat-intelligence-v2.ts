// Design Ref: §R424 — Environmental Impact Assessor
// Plan SC: SC-R424

export interface ProjectEnv {
  readonly projectId: string
  readonly emissionsTon: number
  readonly noiseDb: number
  readonly wastewaterTon: number
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E'

export interface ImpactResult {
  readonly projectId: string
  readonly ghgScore: number
  readonly noiseScore: number
  readonly waterScore: number
  readonly totalImpact: number
  readonly grade: Grade
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function clip(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toGrade(totalImpact: number): Grade {
  if (totalImpact < 20) return 'A'
  if (totalImpact < 40) return 'B'
  if (totalImpact < 60) return 'C'
  if (totalImpact < 80) return 'D'
  return 'E'
}

export class RealtimeThreatIntelligenceV2 {
  private auditLog: AuditEntry[] = []

  assess(project: ProjectEnv): ImpactResult {
    const ghgScore = clip(project.emissionsTon * 2, 0, 100)
    const noiseScore = clip((project.noiseDb - 40) * 2, 0, 100)
    const waterScore = clip(project.wastewaterTon * 5, 0, 100)
    const totalImpact = Math.round(ghgScore * 0.5 + noiseScore * 0.2 + waterScore * 0.3)
    const grade = toGrade(totalImpact)

    this.auditLog.push({ action: 'env.assess', timestamp: new Date().toISOString(), detail: `${project.projectId}:${grade}` })
    return {
      projectId: project.projectId,
      ghgScore: Math.round(ghgScore),
      noiseScore: Math.round(noiseScore),
      waterScore: Math.round(waterScore),
      totalImpact,
      grade,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
