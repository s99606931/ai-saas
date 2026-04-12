/**
 * API Usage Predictor — SVC-AI-ADV-R152 (트랙 B 3차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R146-R153-trackB/SVC-AI-ADV-R152.design.md
 * Plan SC: FR-R152.1 ~ FR-R152.5
 *
 * 시간별 API 사용량 집계 → 이동평균 예측 → Z-score 피크 탐지 → 용량 권고.
 * 순수 계산 — 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export interface CallRecord {
  apiId: string
  timestamp: number
  count: number
}

export interface ForecastPoint {
  hour: string
  predicted: number
  upper: number
}

export interface PeakEvent {
  hour: string
  count: number
  zScore: number
}

export interface CapacityRecommendation {
  apiId: string
  currentPeak: number
  recommendedRps: number
  scaleBy: number
  reason: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  apiId: string
  detail: Record<string, unknown>
}

export class ApiUsagePredictor {
  // apiId → (hourBucket → count)
  private readonly buckets = new Map<string, Map<number, number>>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R152.1 — Design Ref: §3.1 시간별 버킷 집계
  recordCall(record: CallRecord): void {
    const hourBucket = Math.floor(record.timestamp / 3600000)
    if (!this.buckets.has(record.apiId)) {
      this.buckets.set(record.apiId, new Map())
    }
    const apiMap = this.buckets.get(record.apiId)!
    apiMap.set(hourBucket, (apiMap.get(hourBucket) ?? 0) + record.count)
  }

  // Plan SC: FR-R152.2 — Design Ref: §3.2 이동평균 예측 (window=6)
  forecast(apiId: string): ForecastPoint[] {
    const apiMap = this.buckets.get(apiId)
    if (!apiMap || apiMap.size === 0) return []

    const sorted = [...apiMap.entries()].sort((a, b) => a[0] - b[0])
    const counts = sorted.map(([, c]) => c)
    const window = 6
    const result: ForecastPoint[] = []

    for (let i = window - 1; i < counts.length; i++) {
      const slice = counts.slice(i - window + 1, i + 1)
      const avg = slice.reduce((s, v) => s + v, 0) / window
      const variance = slice.reduce((s, v) => s + (v - avg) ** 2, 0) / window
      const std = Math.sqrt(variance)

      const hourBucket = sorted[i]![0]
      const hourLabel = new Date(hourBucket * 3600000).toISOString().slice(0, 13)
      result.push({
        hour: hourLabel,
        predicted: Math.round(avg),
        upper: Math.round(avg + std),
      })
    }

    this.appendAudit('forecast', apiId, { points: result.length })
    return result
  }

  // Plan SC: FR-R152.3 — Design Ref: §3.3 Z-score 피크 탐지 (threshold=2.0)
  detectPeaks(apiId: string): PeakEvent[] {
    const apiMap = this.buckets.get(apiId)
    if (!apiMap || apiMap.size < 2) return []

    const sorted = [...apiMap.entries()].sort((a, b) => a[0] - b[0])
    const counts = sorted.map(([, c]) => c)
    const n = counts.length
    const mean = counts.reduce((s, v) => s + v, 0) / n
    const variance = counts.reduce((s, v) => s + (v - mean) ** 2, 0) / n
    const std = Math.sqrt(variance)

    if (std === 0) return []

    const peaks: PeakEvent[] = []
    for (let i = 0; i < sorted.length; i++) {
      const [hourBucket, count] = sorted[i]!
      const zScore = (count - mean) / std
      if (zScore > 2.0) {
        const hourLabel = new Date(hourBucket * 3600000).toISOString().slice(0, 13)
        peaks.push({ hour: hourLabel, count, zScore: Math.round(zScore * 100) / 100 })
      }
    }

    this.appendAudit('peaks.detect', apiId, { peakCount: peaks.length })
    return peaks
  }

  // Plan SC: FR-R152.4 — Design Ref: §3.4 용량 권고 (peak * 1.5 올림)
  recommendCapacity(apiId: string): CapacityRecommendation | null {
    const apiMap = this.buckets.get(apiId)
    if (!apiMap || apiMap.size === 0) return null

    const currentPeak = Math.max(...apiMap.values())
    const recommendedRps = Math.ceil(currentPeak * 1.5)
    const scaleBy = Math.ceil((recommendedRps / currentPeak) * 10) / 10

    const recommendation: CapacityRecommendation = {
      apiId,
      currentPeak,
      recommendedRps,
      scaleBy,
      reason: `피크 ${currentPeak} rps × 1.5 안전 여유 = ${recommendedRps} rps`,
    }

    this.appendAudit('capacity.recommend', apiId, { currentPeak, recommendedRps })
    return recommendation
  }

  // Plan SC: FR-R152.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, apiId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, apiId, detail })
  }
}
