// Design Ref: §R251 — 공공 통계(KOSIS) 분석 엔진
// Plan SC: SVC-AI-ADV-R251-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type TrendDirection = 'RISING' | 'FALLING' | 'STABLE'
export type VolatilityLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface DataPoint {
  year: number
  value: number
}

export interface StatisticsSeries {
  seriesId: string
  name: string
  unit: string
  dataPoints: DataPoint[]
  grade?: DataGrade
}

export interface TrendAnalysis {
  seriesId: string
  slope: number
  direction: TrendDirection
  confidence: number  // 0~1
  startValue: number
  endValue: number
  changeRate: number  // %
}

export interface Outlier {
  year: number
  value: number
  zScore: number
  severity: 'HIGH' | 'MEDIUM'
}

export interface Insight {
  category: 'TREND' | 'VOLATILITY' | 'EXTREME' | 'CHANGE'
  message: string
  importance: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface AuditEntry {
  timestamp: string
  action: string
  seriesId: string
  detail: Record<string, unknown>
}

export class KosisStatisticsAnalyzer {
  private series = new Map<string, StatisticsSeries>()
  private auditLog: AuditEntry[] = []

  registerSeries(series: StatisticsSeries): void {
    if (series.grade === 'C' || series.grade === 'S') {
      throw new Error(`BLOCKED: ${series.grade}등급 통계는 AI 분석 금지 (N2SF N-05)`)
    }
    if (series.dataPoints.length < 2) {
      throw new Error('최소 2개 이상의 데이터 포인트가 필요합니다')
    }
    const sorted = [...series.dataPoints].sort((a, b) => a.year - b.year)
    this.series.set(series.seriesId, { ...series, dataPoints: sorted })
    this.appendAudit('series.register', series.seriesId, { points: sorted.length })
  }

  analyzeTrend(seriesId: string): TrendAnalysis {
    const s = this.series.get(seriesId)
    if (!s) throw new Error(`Unknown series: ${seriesId}`)

    const n = s.dataPoints.length
    const xs = s.dataPoints.map((p) => p.year)
    const ys = s.dataPoints.map((p) => p.value)
    const meanX = xs.reduce((a, b) => a + b, 0) / n
    const meanY = ys.reduce((a, b) => a + b, 0) / n

    let num = 0
    let denX = 0
    let denY = 0
    for (let i = 0; i < n; i++) {
      const xi = xs[i] ?? 0
      const yi = ys[i] ?? 0
      num += (xi - meanX) * (yi - meanY)
      denX += (xi - meanX) ** 2
      denY += (yi - meanY) ** 2
    }
    const slope = denX === 0 ? 0 : num / denX
    const correlation = denX === 0 || denY === 0 ? 0 : num / Math.sqrt(denX * denY)
    const confidence = Math.min(1, Math.abs(correlation))

    const startValue = ys[0] ?? 0
    const endValue = ys[n - 1] ?? 0
    const changeRate = startValue === 0 ? 0 : ((endValue - startValue) / startValue) * 100

    let direction: TrendDirection = 'STABLE'
    if (Math.abs(changeRate) > 5) {
      direction = changeRate > 0 ? 'RISING' : 'FALLING'
    }

    const result: TrendAnalysis = {
      seriesId,
      slope: Math.round(slope * 1000) / 1000,
      direction,
      confidence: Math.round(confidence * 100) / 100,
      startValue,
      endValue,
      changeRate: Math.round(changeRate * 100) / 100,
    }
    this.appendAudit('trend.analyze', seriesId, { direction, changeRate: result.changeRate })
    return result
  }

  detectOutliers(seriesId: string): Outlier[] {
    const s = this.series.get(seriesId)
    if (!s) throw new Error(`Unknown series: ${seriesId}`)

    const values = s.dataPoints.map((p) => p.value)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    const std = Math.sqrt(variance)
    if (std === 0) return []

    const outliers: Outlier[] = []
    for (const point of s.dataPoints) {
      const z = (point.value - mean) / std
      if (Math.abs(z) >= 2) {
        outliers.push({
          year: point.year,
          value: point.value,
          zScore: Math.round(z * 100) / 100,
          severity: Math.abs(z) >= 3 ? 'HIGH' : 'MEDIUM',
        })
      }
    }
    this.appendAudit('outlier.detect', seriesId, { count: outliers.length })
    return outliers
  }

  generateInsights(seriesId: string): Insight[] {
    const s = this.series.get(seriesId)
    if (!s) throw new Error(`Unknown series: ${seriesId}`)

    const insights: Insight[] = []
    const trend = this.analyzeTrend(seriesId)
    insights.push({
      category: 'TREND',
      message: `${trend.direction === 'RISING' ? '상승' : trend.direction === 'FALLING' ? '하락' : '안정'} 추세 (${trend.changeRate}%)`,
      importance: Math.abs(trend.changeRate) > 20 ? 'HIGH' : 'MEDIUM',
    })

    const values = s.dataPoints.map((p) => p.value)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const std = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length)
    const cv = mean === 0 ? 0 : std / Math.abs(mean)
    const volatilityLevel: VolatilityLevel = cv > 0.3 ? 'HIGH' : cv > 0.15 ? 'MEDIUM' : 'LOW'
    insights.push({
      category: 'VOLATILITY',
      message: `변동성 ${volatilityLevel} (변동계수 ${Math.round(cv * 100) / 100})`,
      importance: volatilityLevel === 'HIGH' ? 'HIGH' : 'LOW',
    })

    const maxPoint = s.dataPoints.reduce((a, b) => (a.value > b.value ? a : b))
    const minPoint = s.dataPoints.reduce((a, b) => (a.value < b.value ? a : b))
    insights.push({
      category: 'EXTREME',
      message: `최대 ${maxPoint.year}년 ${maxPoint.value}${s.unit}, 최소 ${minPoint.year}년 ${minPoint.value}${s.unit}`,
      importance: 'MEDIUM',
    })

    this.appendAudit('insights.generate', seriesId, { count: insights.length })
    return insights
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, seriesId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      seriesId,
      detail,
    })
  }
}
