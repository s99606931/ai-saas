// Design Ref: §R389 — AI기반 공공 서비스 만족도 예측 v2
// Plan SC: SC-R389

export interface SatisfactionSurvey {
  surveyId: string
  serviceId: string
  userId: string
  score: number
  waitTimeMinutes: number
  processSteps: number
  resolvedAtFirstContact: boolean
  channel: 'ONLINE' | 'OFFLINE' | 'PHONE'
}

export interface SatisfactionPrediction {
  serviceId: string
  predictedScore: number
  confidenceInterval: { lower: number; upper: number }
  keyFactors: { factor: string; impact: 'POSITIVE' | 'NEGATIVE'; weight: number }[]
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskUserId(userId: string): string {
  if (userId.length <= 3) return '*'.repeat(userId.length)
  return userId.slice(0, 2) + '*'.repeat(userId.length - 4) + userId.slice(-2)
}

export class PublicSatisfactionPredictorV2 {
  private surveys = new Map<string, SatisfactionSurvey[]>()
  private auditLog: AuditEntry[] = []

  submitSurvey(survey: SatisfactionSurvey): void {
    if (!this.surveys.has(survey.serviceId)) this.surveys.set(survey.serviceId, [])
    this.surveys.get(survey.serviceId)!.push(survey)
    // PII 마스킹 — userId 감사 로그 미노출
    this.auditLog.push({ action: 'survey.submit', timestamp: new Date().toISOString(), detail: `${survey.serviceId}(${maskUserId(survey.userId)})` })
  }

  predict(serviceId: string): SatisfactionPrediction {
    const surveys = this.surveys.get(serviceId) ?? []

    if (surveys.length === 0) {
      this.auditLog.push({ action: 'satisfaction.predict', timestamp: new Date().toISOString(), detail: `${serviceId}:NO_DATA` })
      return {
        serviceId,
        predictedScore: 50,
        confidenceInterval: { lower: 30, upper: 70 },
        keyFactors: [],
        riskLevel: 'MEDIUM',
        recommendations: ['설문 데이터 부족 — 추가 수집 필요'],
      }
    }

    const avgScore = surveys.reduce((s, sv) => s + sv.score, 0) / surveys.length
    const avgWait = surveys.reduce((s, sv) => s + sv.waitTimeMinutes, 0) / surveys.length
    const avgSteps = surveys.reduce((s, sv) => s + sv.processSteps, 0) / surveys.length
    const firstContactRate = surveys.filter((sv) => sv.resolvedAtFirstContact).length / surveys.length

    const keyFactors: SatisfactionPrediction['keyFactors'] = []
    if (firstContactRate >= 0.8) keyFactors.push({ factor: '첫 접촉 해결률', impact: 'POSITIVE', weight: 0.35 })
    else keyFactors.push({ factor: '첫 접촉 해결률', impact: 'NEGATIVE', weight: 0.35 })

    if (avgWait <= 10) keyFactors.push({ factor: '평균 대기시간', impact: 'POSITIVE', weight: 0.25 })
    else keyFactors.push({ factor: '평균 대기시간', impact: 'NEGATIVE', weight: 0.25 })

    if (avgSteps <= 3) keyFactors.push({ factor: '처리 단계 수', impact: 'POSITIVE', weight: 0.2 })
    else keyFactors.push({ factor: '처리 단계 수', impact: 'NEGATIVE', weight: 0.2 })

    // 예측 점수 조정
    let predictedScore = avgScore
    if (avgWait > 30) predictedScore -= 5
    if (avgSteps > 5) predictedScore -= 3
    if (firstContactRate < 0.5) predictedScore -= 7
    predictedScore = Math.max(0, Math.min(100, Math.round(predictedScore)))

    const stdDev = surveys.length > 1
      ? Math.sqrt(surveys.reduce((s, sv) => s + Math.pow(sv.score - avgScore, 2), 0) / surveys.length)
      : 10
    const margin = Math.round(stdDev * 1.96 / Math.sqrt(surveys.length))

    const riskLevel: SatisfactionPrediction['riskLevel'] = predictedScore < 60 ? 'HIGH' : predictedScore < 75 ? 'MEDIUM' : 'LOW'

    const recommendations: string[] = []
    if (avgWait > 30) recommendations.push('평균 대기시간 30분 초과 — 처리 인력 증원 또는 자동화 검토')
    if (firstContactRate < 0.7) recommendations.push('첫 접촉 해결률 70% 미만 — 담당자 교육 강화')
    if (avgSteps > 5) recommendations.push('처리 단계 간소화 — 불필요 절차 제거')

    this.auditLog.push({ action: 'satisfaction.predict', timestamp: new Date().toISOString(), detail: `${serviceId}:${predictedScore}` })
    return {
      serviceId,
      predictedScore,
      confidenceInterval: { lower: Math.max(0, predictedScore - margin), upper: Math.min(100, predictedScore + margin) },
      keyFactors,
      riskLevel,
      recommendations,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
