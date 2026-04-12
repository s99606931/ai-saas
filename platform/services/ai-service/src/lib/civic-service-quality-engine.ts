// Design Ref: §R264 — 시민 민원 품질 점수 엔진
// Plan SC: SVC-AI-ADV-R264-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type QualityGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'

export interface CivicRequest {
  requestId: string
  departmentId: string
  citizenId: string
  submittedAt: string
  respondedAt?: string
  resolvedAt?: string
  reinquiryCount: number
  satisfaction?: number // 1~5
}

export interface DepartmentScore {
  departmentId: string
  totalRequests: number
  responseScore: number
  resolutionScore: number
  reinquiryScore: number
  satisfactionScore: number
  overallScore: number
  grade: QualityGrade
}

export interface Recommendation {
  departmentId: string
  items: string[]
}

export interface RequestScore {
  requestId: string
  responseScore: number
  resolutionScore: number
  reinquiryScore: number
  satisfactionScore: number
  overallScore: number
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

export class CivicServiceQualityEngine {
  private requests = new Map<string, CivicRequest>()
  private auditLog: AuditEntry[] = []

  recordRequest(req: CivicRequest, caller: string, grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 민원 데이터 등록 금지 (N2SF N-05)`)
    }
    if (req.reinquiryCount < 0) {
      throw new Error('reinquiryCount는 0 이상이어야 합니다')
    }
    if (req.satisfaction !== undefined && (req.satisfaction < 1 || req.satisfaction > 5)) {
      throw new Error('satisfaction은 1~5 범위여야 합니다')
    }
    if (this.requests.has(req.requestId)) {
      throw new Error(`중복 request: ${req.requestId}`)
    }
    this.requests.set(req.requestId, { ...req })
    this.appendAudit('request.record', this.mask(caller), {
      requestId: req.requestId,
      departmentId: req.departmentId,
      citizenIdMasked: this.mask(req.citizenId),
    })
  }

  scoreRequest(requestId: string): RequestScore {
    const req = this.requests.get(requestId)
    if (!req) throw new Error(`Unknown request: ${requestId}`)
    return this.calcRequestScore(req)
  }

  scoreDepartment(departmentId: string): DepartmentScore {
    const deptRequests = [...this.requests.values()].filter((r) => r.departmentId === departmentId)
    if (deptRequests.length === 0) {
      throw new Error(`부서 기록 없음: ${departmentId}`)
    }

    let respSum = 0
    let resolSum = 0
    let reinqSum = 0
    let satisSum = 0
    let satisCount = 0

    for (const r of deptRequests) {
      const s = this.calcRequestScore(r)
      respSum += s.responseScore
      resolSum += s.resolutionScore
      reinqSum += s.reinquiryScore
      if (r.satisfaction !== undefined) {
        satisSum += s.satisfactionScore
        satisCount++
      }
    }

    const count = deptRequests.length
    const responseScore = Math.round(respSum / count)
    const resolutionScore = Math.round(resolSum / count)
    const reinquiryScore = Math.round(reinqSum / count)
    const satisfactionScore = satisCount > 0 ? Math.round(satisSum / satisCount) : 0

    const overall = Math.round(
      responseScore * 0.3 + resolutionScore * 0.3 + reinquiryScore * 0.2 + satisfactionScore * 0.2
    )

    const result: DepartmentScore = {
      departmentId,
      totalRequests: count,
      responseScore,
      resolutionScore,
      reinquiryScore,
      satisfactionScore,
      overallScore: overall,
      grade: this.gradeFromScore(overall),
    }
    this.appendAudit('department.score', 'SYSTEM', {
      departmentId,
      overall,
      grade: result.grade,
    })
    return result
  }

  rankDepartments(): DepartmentScore[] {
    const deptIds = new Set<string>()
    for (const r of this.requests.values()) deptIds.add(r.departmentId)
    const scores = [...deptIds].map((id) => this.scoreDepartment(id))
    scores.sort((a, b) => b.overallScore - a.overallScore)
    return scores
  }

  generateRecommendations(departmentId: string): Recommendation {
    const s = this.scoreDepartment(departmentId)
    const items: string[] = []
    if (s.responseScore < 60) {
      items.push(`응답 속도 개선 필요 (현재 ${s.responseScore}점) — 24시간 이내 1차 응답 목표`)
    }
    if (s.resolutionScore < 60) {
      items.push(`해결률 개선 필요 (현재 ${s.resolutionScore}점) — 미해결 민원 추적 체계 강화`)
    }
    if (s.reinquiryScore < 60) {
      items.push(`재문의율 개선 필요 (현재 ${s.reinquiryScore}점) — 초기 응답 품질 향상 필요`)
    }
    if (s.satisfactionScore < 60) {
      items.push(`만족도 개선 필요 (현재 ${s.satisfactionScore}점) — 친절도·전문성 교육 권고`)
    }
    return { departmentId, items }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private calcRequestScore(r: CivicRequest): RequestScore {
    // 응답 속도
    let responseScore = 0
    if (r.respondedAt) {
      const hours =
        (new Date(r.respondedAt).getTime() - new Date(r.submittedAt).getTime()) / 3600000
      if (hours <= 24) responseScore = 100
      else if (hours <= 48) responseScore = 80
      else if (hours <= 168) responseScore = 50
      else responseScore = 0
    }

    // 해결
    const resolutionScore = r.resolvedAt ? 100 : 0

    // 재문의 (역지표)
    const reinquiryScore = Math.max(0, 100 - r.reinquiryCount * 25)

    // 만족도
    const satisfactionScore =
      r.satisfaction !== undefined ? Math.round(((r.satisfaction - 1) / 4) * 100) : 0

    const overall = Math.round(
      responseScore * 0.3 + resolutionScore * 0.3 + reinquiryScore * 0.2 + satisfactionScore * 0.2
    )

    return {
      requestId: r.requestId,
      responseScore,
      resolutionScore,
      reinquiryScore,
      satisfactionScore,
      overallScore: overall,
    }
  }

  private gradeFromScore(score: number): QualityGrade {
    if (score >= 90) return 'EXCELLENT'
    if (score >= 75) return 'GOOD'
    if (score >= 60) return 'FAIR'
    return 'POOR'
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(action: string, callerMasked: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
