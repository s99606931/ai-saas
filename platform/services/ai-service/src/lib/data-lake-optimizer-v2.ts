// Design Ref: §R457 — AI기반 지능형 데이터 레이크 최적화 v2
// Plan SC: SVC-AI-ADV-R457-SC01

export type StorageTier = 'HOT' | 'WARM' | 'COLD' | 'ARCHIVE'
export type OptimizationAction = 'MOVE_TO_WARM' | 'MOVE_TO_COLD' | 'ARCHIVE' | 'DELETE' | 'KEEP' | 'COMPRESS'
export type DataGrade = 'C' | 'S' | 'O'

export interface DataLakeObject {
  objectId: string
  sizeBytes: number
  storageTier: StorageTier
  lastAccessedDaysAgo: number
  accessFrequencyPerMonth: number
  grade: DataGrade
  compressed: boolean
}

export interface OptimizationRecommendation {
  objectId: string
  currentTier: StorageTier
  action: OptimizationAction
  estimatedSavingKrw: number
  reason: string
}

export interface DataLakeOptimizationReport {
  totalObjects: number
  totalSizeBytes: number
  recommendations: OptimizationRecommendation[]
  estimatedTotalSavingKrw: number
  hotObjectCount: number
  coldObjectCount: number
}

interface AuditEntry {
  timestamp: string
  action: string
  objectId: string
  detail: Record<string, unknown>
}

// 스토리지 티어별 GB당 월 요금 (원)
const TIER_COST_PER_GB: Record<StorageTier, number> = {
  HOT: 30, WARM: 15, COLD: 5, ARCHIVE: 1,
}

export class DataLakeOptimizerV2 {
  private objects = new Map<string, DataLakeObject>()
  private auditLog: AuditEntry[] = []

  registerObject(obj: DataLakeObject): void {
    // N2SF C/S 등급 차단
    if (obj.grade === 'C' || obj.grade === 'S') {
      throw new Error(`BLOCKED: ${obj.grade}등급 데이터는 AI 레이크 최적화 금지 (N2SF N-05)`)
    }
    this.objects.set(obj.objectId, obj)
    this.appendAudit('object.register', obj.objectId, { tier: obj.storageTier, sizeBytes: obj.sizeBytes })
  }

  optimize(): DataLakeOptimizationReport {
    const objects = Array.from(this.objects.values())
    this.appendAudit('lake.optimize', 'system', { objectCount: objects.length })

    const recommendations: OptimizationRecommendation[] = []
    const totalSizeBytes = objects.reduce((s, o) => s + o.sizeBytes, 0)

    for (const obj of objects) {
      const sizeGb = obj.sizeBytes / (1024 ** 3)
      const currentCost = TIER_COST_PER_GB[obj.storageTier] * sizeGb

      let action: OptimizationAction = 'KEEP'
      let targetTier: StorageTier = obj.storageTier
      let reason = '최적 티어 유지'

      if (obj.storageTier === 'HOT') {
        if (obj.lastAccessedDaysAgo > 90 || obj.accessFrequencyPerMonth < 1) {
          action = 'MOVE_TO_COLD'
          targetTier = 'COLD'
          reason = `HOT 티어 ${obj.lastAccessedDaysAgo}일 미접근 — COLD 이동 권장`
        } else if (obj.lastAccessedDaysAgo > 30 || obj.accessFrequencyPerMonth < 5) {
          action = 'MOVE_TO_WARM'
          targetTier = 'WARM'
          reason = `HOT 티어 저빈도 접근 — WARM 이동 권장`
        } else if (!obj.compressed && sizeGb > 1) {
          action = 'COMPRESS'
          reason = '1GB 이상 HOT 객체 — 압축으로 비용 절감 권장'
        }
      } else if (obj.storageTier === 'WARM') {
        if (obj.lastAccessedDaysAgo > 180) {
          action = 'ARCHIVE'
          targetTier = 'ARCHIVE'
          reason = `WARM 티어 ${obj.lastAccessedDaysAgo}일 미접근 — 아카이브 권장`
        } else if (obj.lastAccessedDaysAgo > 90) {
          action = 'MOVE_TO_COLD'
          targetTier = 'COLD'
          reason = `WARM 티어 ${obj.lastAccessedDaysAgo}일 미접근 — COLD 이동 권장`
        }
      } else if (obj.storageTier === 'COLD' && obj.lastAccessedDaysAgo > 365) {
        action = 'ARCHIVE'
        targetTier = 'ARCHIVE'
        reason = `COLD 티어 1년 이상 미접근 — 아카이브 또는 삭제 검토`
      }

      if (action !== 'KEEP' && action !== 'COMPRESS') {
        const savingCost = (currentCost - TIER_COST_PER_GB[targetTier] * sizeGb)
        recommendations.push({
          objectId: obj.objectId,
          currentTier: obj.storageTier,
          action,
          estimatedSavingKrw: Math.max(0, Math.round(savingCost)),
          reason,
        })
      } else if (action === 'COMPRESS') {
        recommendations.push({ objectId: obj.objectId, currentTier: obj.storageTier, action, estimatedSavingKrw: Math.round(currentCost * 0.4), reason })
      }
    }

    const estimatedTotalSavingKrw = recommendations.reduce((s, r) => s + r.estimatedSavingKrw, 0)
    const hotObjectCount = objects.filter((o) => o.storageTier === 'HOT').length
    const coldObjectCount = objects.filter((o) => o.storageTier === 'COLD' || o.storageTier === 'ARCHIVE').length

    return { totalObjects: objects.length, totalSizeBytes, recommendations, estimatedTotalSavingKrw, hotObjectCount, coldObjectCount }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, objectId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, objectId, detail })
  }
}
