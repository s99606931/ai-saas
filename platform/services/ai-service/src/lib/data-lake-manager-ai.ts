// Design Ref: §R275 — AI기반 데이터 레이크 자동 관리
// Plan SC: SVC-AI-ADV-R275-SC01
// CSAP D-06: 감사 로그, N2SF N-05: C/S등급 차단

export type DataGrade = 'C' | 'S' | 'O'
export type StorageTier = 'HOT' | 'WARM' | 'COLD' | 'ARCHIVE'
export type PartitionStrategy = 'BY_DATE' | 'BY_TENANT' | 'BY_CATEGORY' | 'NONE'

export interface DataLakeZone {
  zoneId: string
  name: string
  dataGrade: DataGrade
  currentSizeGb: number
  maxSizeGb: number
  retentionDays: number
}

export interface DataLakeMetric {
  zoneId: string
  timestamp: number
  queryCountPerHour: number
  lastAccessedDaysAgo: number
  growthRateGbPerDay: number
}

export interface LakeManagementPlan {
  zoneId: string
  recommendedTier: StorageTier
  recommendedPartition: PartitionStrategy
  estimatedCostSavingPercent: number
  capacityAlertLevel: 'NORMAL' | 'WARNING' | 'CRITICAL'
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  zoneId: string
  detail: Record<string, unknown>
}

export class DataLakeManagerAi {
  private zones = new Map<string, DataLakeZone>()
  private metrics = new Map<string, DataLakeMetric[]>()
  private auditLog: AuditEntry[] = []

  registerZone(zone: DataLakeZone): void {
    // N2SF: C/S 등급 데이터 레이크 AI 관리 차단
    if (zone.dataGrade === 'C' || zone.dataGrade === 'S') {
      throw new Error(`BLOCKED: ${zone.dataGrade}등급 데이터 레이크 AI 관리 금지 (N2SF N-05)`)
    }
    this.zones.set(zone.zoneId, zone)
    this.metrics.set(zone.zoneId, [])
    this.appendAudit('zone.register', zone.zoneId, { name: zone.name, grade: zone.dataGrade })
  }

  recordMetric(metric: DataLakeMetric): void {
    if (!this.zones.has(metric.zoneId)) throw new Error(`Unknown zone: ${metric.zoneId}`)
    const list = this.metrics.get(metric.zoneId) ?? []
    list.push(metric)
    this.metrics.set(metric.zoneId, list)
  }

  plan(zoneId: string): LakeManagementPlan {
    const zone = this.zones.get(zoneId)
    if (!zone) throw new Error(`Unknown zone: ${zoneId}`)

    const history = this.metrics.get(zoneId) ?? []
    const recommendations: string[] = []

    let recommendedTier: StorageTier = 'HOT'
    let estimatedCostSavingPercent = 0
    let recommendedPartition: PartitionStrategy = 'NONE'

    const capacityUtil = zone.currentSizeGb / zone.maxSizeGb
    const capacityAlertLevel =
      capacityUtil >= 0.9 ? 'CRITICAL' :
      capacityUtil >= 0.75 ? 'WARNING' : 'NORMAL'

    if (capacityAlertLevel === 'CRITICAL') {
      recommendations.push(`용량 ${Math.round(capacityUtil * 100)}% — 즉시 확장 또는 데이터 이관 필요`)
    }

    if (history.length > 0) {
      const latest = history[history.length - 1]!
      const avgQueryPerHour = history.reduce((s, m) => s + m.queryCountPerHour, 0) / history.length

      if (latest.lastAccessedDaysAgo > 90) {
        recommendedTier = 'ARCHIVE'
        estimatedCostSavingPercent = 70
        recommendations.push(`마지막 접근 ${latest.lastAccessedDaysAgo}일 전 — ARCHIVE 계층 이관 권고`)
      } else if (latest.lastAccessedDaysAgo > 30 || avgQueryPerHour < 1) {
        recommendedTier = 'COLD'
        estimatedCostSavingPercent = 40
        recommendations.push(`저빈도 접근 — COLD 계층 이관 권고`)
      } else if (latest.lastAccessedDaysAgo > 7) {
        recommendedTier = 'WARM'
        estimatedCostSavingPercent = 20
      }

      // 파티셔닝 전략
      if (latest.growthRateGbPerDay > 10) {
        recommendedPartition = 'BY_DATE'
        recommendations.push('높은 증가율 — 날짜 기반 파티셔닝 권고')
      } else if (zone.retentionDays < 30) {
        recommendedPartition = 'BY_CATEGORY'
      }
    }

    this.appendAudit('zone.plan', zoneId, { recommendedTier, capacityAlertLevel, estimatedCostSavingPercent })

    return { zoneId, recommendedTier, recommendedPartition, estimatedCostSavingPercent, capacityAlertLevel, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, zoneId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, zoneId, detail })
  }
}
