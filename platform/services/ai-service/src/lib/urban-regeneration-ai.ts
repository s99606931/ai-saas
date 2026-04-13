// Plan SC: SVC-AI-ADV-R636
// Design Ref: §DECLINE_INDEX — 쇠퇴지수(인구/산업/주거) 가중합 기반 도시재생 우선순위

type DataGrade = 'O' | 'C' | 'S'

interface DistrictMetrics {
  districtId: string
  populationDecline: number
  industryDecline: number
  oldBuildingRatio: number
  vacancyRate: number
}

interface RegenerationPriority {
  districtId: string
  declineIndex: number
  priority: 'high' | 'medium' | 'low'
  recommendedStrategy: string[]
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export class UrbanRegenerationAI {
  private districts = new Map<string, DistrictMetrics>()
  private auditLog: AuditEntry[] = []

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerDistrict(metrics: DistrictMetrics, grade: DataGrade = 'O'): DistrictMetrics {
    blockClassifiedData(grade)
    this.districts.set(metrics.districtId, metrics)
    this.log('district.register', `districtId=${metrics.districtId}`)
    return metrics
  }

  computePriority(districtId: string): RegenerationPriority {
    const m = this.districts.get(districtId)
    if (!m) throw new Error('district 없음')

    const declineIndex = Math.round(
      m.populationDecline * 0.3 +
        m.industryDecline * 0.3 +
        m.oldBuildingRatio * 0.2 +
        m.vacancyRate * 0.2,
    )
    const priority: RegenerationPriority['priority'] =
      declineIndex >= 70 ? 'high' : declineIndex >= 40 ? 'medium' : 'low'

    const strategy: string[] = []
    if (m.populationDecline >= 50) strategy.push('청년유입 프로그램')
    if (m.industryDecline >= 50) strategy.push('산업집적지 육성')
    if (m.oldBuildingRatio >= 60) strategy.push('노후건축 리모델링')
    if (m.vacancyRate >= 30) strategy.push('빈집 활용')

    this.log(
      'priority.compute',
      `districtId=${districtId} index=${declineIndex} priority=${priority}`,
    )
    return { districtId, declineIndex, priority, recommendedStrategy: strategy }
  }

  rankDistricts(): RegenerationPriority[] {
    const results: RegenerationPriority[] = []
    for (const d of this.districts.values()) {
      results.push(this.computePriority(d.districtId))
    }
    results.sort((a, b) => b.declineIndex - a.declineIndex)
    return results
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
