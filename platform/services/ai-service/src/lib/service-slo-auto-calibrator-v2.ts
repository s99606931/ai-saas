// Design Ref: §R428 — Citizen Engagement Analyzer
// Plan SC: SC-R428

export interface EngagementInput {
  readonly policyId: string
  readonly participants: number
  readonly targetPopulation: number
  readonly satisfaction: number
}

export type Grade = 'LOW' | 'MID' | 'HIGH'

export interface EngagementResult {
  readonly policyId: string
  readonly participationRate: number
  readonly responseScore: number
  readonly engagementIndex: number
  readonly grade: Grade
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceSloAutoCalibratorV2 {
  private auditLog: AuditEntry[] = []

  analyze(input: EngagementInput): EngagementResult {
    const participationRate = input.targetPopulation > 0
      ? Math.round((input.participants / input.targetPopulation) * 1000) / 1000
      : 0

    const responseScore = Math.max(0, Math.min(100, Math.round(participationRate * 100)))
    const engagementIndex = Math.round(responseScore * 0.5 + input.satisfaction * 0.5)

    const grade: Grade = engagementIndex >= 70 ? 'HIGH' : engagementIndex >= 40 ? 'MID' : 'LOW'

    this.auditLog.push({ action: 'engagement.analyze', timestamp: new Date().toISOString(), detail: `${input.policyId}:${grade}` })
    return { policyId: input.policyId, participationRate, responseScore, engagementIndex, grade }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
