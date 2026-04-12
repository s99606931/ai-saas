/**
 * Department Performance Dashboard — SVC-AI-ADV-R190 (트랙 B 5차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R190/SVC-AI-ADV-R190.design.md
 * Plan SC: FR-R190.1 ~ FR-R190.5
 *
 * 부서 KPI 등록 → 실적 기록 → 달성률/성과등급 산정.
 */

export type PerfGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface Kpi {
  kpiId: string
  department: string
  name: string
  targetValue: number
  unit: string
}

export interface KpiRecord {
  kpiId: string
  period: string
  actualValue: number
}

export interface DeptPerformance {
  department: string
  avgAchievementRate: number
  grade: PerfGrade
  kpiCount: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

export class DepartmentPerformanceDashboard {
  private readonly kpis = new Map<string, Kpi>()
  private readonly records: KpiRecord[] = []
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R190.1
  registerKpi(kpi: Kpi): void {
    this.kpis.set(kpi.kpiId, { ...kpi })
    this.appendAudit('kpi.register', { kpiId: kpi.kpiId, department: kpi.department })
  }

  // Plan SC: FR-R190.2
  recordActual(record: KpiRecord): void {
    const kpi = this.kpis.get(record.kpiId)
    if (!kpi) throw new Error(`Unknown KPI: ${record.kpiId}`)
    this.records.push({ ...record })
    this.appendAudit('actual.record', { kpiId: record.kpiId, period: record.period })
  }

  // Plan SC: FR-R190.3 + FR-R190.4 — Design Ref: §알고리즘
  getDeptPerformance(department: string): DeptPerformance {
    const deptKpis = [...this.kpis.values()].filter((k) => k.department === department)
    if (deptKpis.length === 0) {
      return { department, avgAchievementRate: 0, grade: 'D', kpiCount: 0 }
    }

    const rates: number[] = []
    for (const kpi of deptKpis) {
      const kpiRecords = this.records.filter((r) => r.kpiId === kpi.kpiId)
      if (kpiRecords.length === 0) continue
      const avg = kpiRecords.reduce((s, r) => s + r.actualValue, 0) / kpiRecords.length
      const rate = Math.min(1.5, avg / kpi.targetValue)
      rates.push(rate)
    }

    const avgRate = rates.length === 0 ? 0 : rates.reduce((s, r) => s + r, 0) / rates.length
    const grade = this.calcGrade(avgRate)

    this.appendAudit('performance.get', { department, avgRate, grade })
    return {
      department,
      avgAchievementRate: Math.round(avgRate * 10000) / 10000,
      grade,
      kpiCount: deptKpis.length,
    }
  }

  // Plan SC: FR-R190.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private calcGrade(rate: number): PerfGrade {
    if (rate >= 1.2) return 'S'
    if (rate >= 0.9) return 'A'
    if (rate >= 0.7) return 'B'
    if (rate >= 0.5) return 'C'
    return 'D'
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
