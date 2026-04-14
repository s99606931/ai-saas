// Design Ref: §위험 등급 — PublicInstitutionRiskScorerV2
// Plan SC: SVC-AI-ADV-R497

import { createHash } from 'crypto'

type RiskLevel = 'high' | 'medium' | 'low'

interface Institution {
  institutionId: string
  name: string
  type: string
}

interface AuditEntry {
  timestamp: string
  action: string
  institutionId: string
  maskedInstitutionId?: string
  details?: Record<string, unknown>
}

export class PublicInstitutionRiskScorerV2 {
  private institutions = new Map<string, Institution>()
  private riskScores = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerInstitution(institutionId: string, name: string, type: string): Institution {
    const institution: Institution = { institutionId, name, type }
    this.institutions.set(institutionId, institution)
    this.riskScores.set(institutionId, 0)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_INSTITUTION',
      institutionId,
      details: { name, type },
    })
    return institution
  }

  recordRiskFactor(
    institutionId: string,
    riskFactor: string,
    score: number,
    dataGrade?: string
  ): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.institutions.has(institutionId)) {
      throw new Error(`기관을 찾을 수 없습니다: ${institutionId}`)
    }
    const current = this.riskScores.get(institutionId) ?? 0
    this.riskScores.set(institutionId, Math.min(100, current + score))
    const maskedId = createHash('sha256').update(institutionId).digest('hex').substring(0, 16)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_RISK_FACTOR',
      institutionId,
      maskedInstitutionId: maskedId,
      details: { riskFactor, score },
    })
  }

  getRiskScore(institutionId: string): number {
    if (!this.institutions.has(institutionId)) {
      throw new Error(`기관을 찾을 수 없습니다: ${institutionId}`)
    }
    return this.riskScores.get(institutionId) ?? 0
  }

  getRiskLevel(institutionId: string): RiskLevel {
    const score = this.getRiskScore(institutionId)
    if (score >= 70) return 'high'
    if (score >= 40) return 'medium'
    return 'low'
  }

  getHighRiskInstitutions(): Institution[] {
    return Array.from(this.institutions.values()).filter(
      (inst) => this.getRiskLevel(inst.institutionId) === 'high'
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
