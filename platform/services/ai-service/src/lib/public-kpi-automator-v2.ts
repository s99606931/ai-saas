// Design Ref: §클래스 설계 — PublicKpiAutomatorV2
// Plan SC: SVC-AI-ADV-R493

import { createHash } from 'crypto'

interface KpiItem {
  kpiId: string
  name: string
  targetValue: number
  unit: string
}

interface AuditEntry {
  timestamp: string
  action: string
  kpiId: string
  maskedKpiId?: string
  details?: Record<string, unknown>
}

export class PublicKpiAutomatorV2 {
  private kpis = new Map<string, KpiItem>()
  private actuals = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerKpi(kpiId: string, name: string, targetValue: number, unit: string): KpiItem {
    const item: KpiItem = { kpiId, name, targetValue, unit }
    this.kpis.set(kpiId, item)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_KPI',
      kpiId,
      details: { name, targetValue, unit },
    })
    return item
  }

  recordActual(kpiId: string, actualValue: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.kpis.has(kpiId)) throw new Error(`KPI를 찾을 수 없습니다: ${kpiId}`)
    this.actuals.set(kpiId, actualValue)
    const maskedKpiId = createHash('sha256').update(kpiId).digest('hex').substring(0, 16)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_ACTUAL',
      kpiId,
      maskedKpiId,
      details: { actualValue },
    })
  }

  getAchievementRate(kpiId: string): number {
    const kpi = this.kpis.get(kpiId)
    if (!kpi) throw new Error(`KPI를 찾을 수 없습니다: ${kpiId}`)
    const actual = this.actuals.get(kpiId) ?? 0
    if (kpi.targetValue === 0) return 100
    return (actual / kpi.targetValue) * 100
  }

  getUnderperformingKpis(): KpiItem[] {
    return Array.from(this.kpis.values()).filter(
      (kpi) => this.getAchievementRate(kpi.kpiId) < 100
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
