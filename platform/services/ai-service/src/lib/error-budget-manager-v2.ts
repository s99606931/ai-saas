// Design Ref: §R430 — AI기반 지능형 오류 예산 관리 v2
// Plan SC: SVC-AI-ADV-R430-SC01

export type SLOType = 'AVAILABILITY' | 'LATENCY' | 'ERROR_RATE' | 'THROUGHPUT'
export type BudgetStatus = 'HEALTHY' | 'AT_RISK' | 'EXHAUSTED' | 'CRITICAL'

export interface SLODefinition {
  sloId: string
  serviceId: string
  type: SLOType
  target: number        // 0..1 (예: 0.999 = 99.9%)
  windowDays: number    // 측정 윈도우 (일)
}

export interface SLOObservation {
  sloId: string
  observedAt: number    // epoch ms
  actualValue: number   // 0..1
}

export interface ErrorBudgetReport {
  sloId: string
  serviceId: string
  type: SLOType
  target: number
  consumed: number      // 소비된 예산 비율 (0..1)
  remaining: number     // 잔여 예산 비율 (0..1)
  status: BudgetStatus
  burnRate: number      // 소비 속도 (1 = 정상, >1 = 초과 소비)
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  sloId: string
  detail: Record<string, unknown>
}

export class ErrorBudgetManagerV2 {
  private slos = new Map<string, SLODefinition>()
  private observations = new Map<string, SLOObservation[]>()
  private auditLog: AuditEntry[] = []

  registerSLO(slo: SLODefinition): void {
    this.slos.set(slo.sloId, slo)
    this.appendAudit('slo.register', slo.sloId, { serviceId: slo.serviceId, type: slo.type, target: slo.target })
  }

  recordObservation(obs: SLOObservation): void {
    const list = this.observations.get(obs.sloId) ?? []
    list.push(obs)
    this.observations.set(obs.sloId, list)
  }

  getReport(sloId: string): ErrorBudgetReport {
    const slo = this.slos.get(sloId)
    if (!slo) throw new Error(`Unknown SLO: ${sloId}`)

    const windowMs = slo.windowDays * 24 * 3600 * 1000
    const cutoff = Date.now() - windowMs
    const all = this.observations.get(sloId) ?? []
    const recent = all.filter((o) => o.observedAt >= cutoff)

    this.appendAudit('budget.report', sloId, { observationCount: recent.length })

    if (recent.length === 0) {
      return {
        sloId, serviceId: slo.serviceId, type: slo.type, target: slo.target,
        consumed: 0, remaining: 1, status: 'HEALTHY', burnRate: 0,
        recommendation: '관측 데이터 없음 — 모니터링 에이전트 확인 필요',
      }
    }

    // 허용 오류 예산: 1 - target (예: 0.001 = 0.1%)
    const allowedError = 1 - slo.target

    // 실제 오류 비율: 목표 미달 비율 평균
    const totalViolation = recent.reduce((sum, o) => {
      const miss = Math.max(0, slo.target - o.actualValue)
      return sum + miss
    }, 0)
    const avgViolation = totalViolation / recent.length

    // 소비 비율
    const consumed = allowedError > 0 ? Math.min(1, avgViolation / allowedError) : (avgViolation > 0 ? 1 : 0)
    const remaining = 1 - consumed

    // 소비 속도: 현재 소비율 / 정상 소비율
    // 정상 소비율 = 1 (윈도우 전체에서 고르게 소비)
    const burnRate = consumed > 0 ? consumed / (1 / slo.windowDays) : 0

    const status: BudgetStatus =
      consumed >= 1 ? 'EXHAUSTED'
        : consumed >= 0.9 ? 'CRITICAL'
        : consumed >= 0.5 ? 'AT_RISK'
        : 'HEALTHY'

    const recommendation =
      status === 'EXHAUSTED' ? '오류 예산 소진 — 즉시 서비스 동결 및 장애 대응 필요'
        : status === 'CRITICAL' ? '오류 예산 90% 소비 — 배포 중단 및 안정화 집중'
        : status === 'AT_RISK' ? '오류 예산 50% 소비 — 배포 빈도 축소 및 테스트 강화'
        : '오류 예산 양호 — 정상 운영 가능'

    return { sloId, serviceId: slo.serviceId, type: slo.type, target: slo.target, consumed, remaining, status, burnRate, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, sloId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, sloId, detail })
  }
}
