// Design Ref: §R368 — AI기반 공공 민원 패턴 예측
// Plan SC: SVC-AI-ADV-R368-SC01

export type ComplaintCategory = '교통' | '환경' | '복지' | '건설' | '행정' | '기타'
export type SeasonalPattern = 'PEAK' | 'NORMAL' | 'LOW'
export type DataGrade = 'C' | 'S' | 'O'

export interface ComplaintRecord {
  complaintId: string
  category: ComplaintCategory
  submittedAt: string  // ISO date string
  resolutionDays: number
  region: string
  grade: DataGrade
}

export interface PredictionResult {
  category: ComplaintCategory
  predictedVolume: number
  trend: 'INCREASING' | 'STABLE' | 'DECREASING'
  seasonalPattern: SeasonalPattern
  avgResolutionDays: number
  hotRegions: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  category: string
  detail: Record<string, unknown>
}

const SEASONAL_PEAKS: Record<ComplaintCategory, number[]> = {
  '교통': [3, 4, 5, 9, 10, 11],   // 봄/가을 (1-indexed month)
  '환경': [6, 7, 8],               // 여름
  '복지': [1, 2, 12],             // 겨울
  '건설': [3, 4, 5, 6],           // 봄~초여름
  '행정': [1, 3, 7, 8],           // 연초/중반기
  '기타': [],
}

export class ComplaintPatternPredictorAI {
  private records: ComplaintRecord[] = []
  private auditLog: AuditEntry[] = []

  ingest(record: ComplaintRecord): void {
    // N2SF C/S 등급 차단
    if (record.grade === 'C' || record.grade === 'S') {
      throw new Error(`BLOCKED: ${record.grade}등급 민원 데이터는 AI 분석 금지 (N2SF N-05)`)
    }
    this.records.push(record)
  }

  predict(category: ComplaintCategory): PredictionResult {
    const filtered = this.records.filter((r) => r.category === category)
    this.appendAudit('predict', category, { recordCount: filtered.length })

    if (filtered.length === 0) {
      return {
        category,
        predictedVolume: 0,
        trend: 'STABLE',
        seasonalPattern: 'NORMAL',
        avgResolutionDays: 0,
        hotRegions: [],
      }
    }

    // 트렌드: 최근 절반 vs 앞 절반
    const half = Math.floor(filtered.length / 2)
    const firstHalf = half
    const secondHalf = filtered.length - half
    const trend: PredictionResult['trend'] =
      secondHalf >= firstHalf && secondHalf > 0 ? 'INCREASING'
        : secondHalf < firstHalf ? 'DECREASING'
        : 'STABLE'

    // 예측 볼륨: 현재 총량 × 트렌드 계수
    const trendMultiplier = trend === 'INCREASING' ? 1.2 : trend === 'DECREASING' ? 0.8 : 1.0
    const predictedVolume = Math.round(filtered.length * trendMultiplier)

    // 계절 패턴
    const currentMonth = new Date().getMonth() + 1
    const peakMonths = SEASONAL_PEAKS[category]
    const seasonalPattern: SeasonalPattern = peakMonths.includes(currentMonth) ? 'PEAK' : 'NORMAL'

    // 평균 처리 기간
    const avgResolutionDays = Math.round(
      filtered.reduce((s, r) => s + r.resolutionDays, 0) / filtered.length,
    )

    // 핫 지역 (상위 3개)
    const regionMap = new Map<string, number>()
    for (const r of filtered) {
      regionMap.set(r.region, (regionMap.get(r.region) ?? 0) + 1)
    }
    const hotRegions = Array.from(regionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([region]) => region)

    return { category, predictedVolume, trend, seasonalPattern, avgResolutionDays, hotRegions }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, category: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, category, detail })
  }
}
