import { describe, it, expect, beforeEach } from 'vitest'
import { KosisStatisticsAnalyzer, type StatisticsSeries } from '../kosis-statistics-analyzer'

describe('KosisStatisticsAnalyzer', () => {
  let analyzer: KosisStatisticsAnalyzer

  const risingSeries: StatisticsSeries = {
    seriesId: 'POP001',
    name: '인구',
    unit: '명',
    grade: 'O',
    dataPoints: [
      { year: 2020, value: 1000 },
      { year: 2021, value: 1050 },
      { year: 2022, value: 1100 },
      { year: 2023, value: 1160 },
      { year: 2024, value: 1220 },
    ],
  }

  beforeEach(() => {
    analyzer = new KosisStatisticsAnalyzer()
  })

  it('C등급 시리즈 차단', () => {
    expect(() =>
      analyzer.registerSeries({ ...risingSeries, grade: 'C' })
    ).toThrow('BLOCKED')
  })

  it('데이터 포인트 2개 미만 거부', () => {
    expect(() =>
      analyzer.registerSeries({ ...risingSeries, dataPoints: [{ year: 2020, value: 100 }] })
    ).toThrow('최소 2개')
  })

  it('상승 추세 탐지', () => {
    analyzer.registerSeries(risingSeries)
    const trend = analyzer.analyzeTrend('POP001')
    expect(trend.direction).toBe('RISING')
    expect(trend.changeRate).toBeGreaterThan(0)
    expect(trend.slope).toBeGreaterThan(0)
  })

  it('하락 추세 탐지', () => {
    analyzer.registerSeries({
      ...risingSeries,
      seriesId: 'POP002',
      dataPoints: [
        { year: 2020, value: 1000 },
        { year: 2021, value: 900 },
        { year: 2022, value: 800 },
      ],
    })
    const trend = analyzer.analyzeTrend('POP002')
    expect(trend.direction).toBe('FALLING')
    expect(trend.changeRate).toBeLessThan(0)
  })

  it('안정 추세 탐지', () => {
    analyzer.registerSeries({
      ...risingSeries,
      seriesId: 'POP003',
      dataPoints: [
        { year: 2020, value: 1000 },
        { year: 2021, value: 1010 },
        { year: 2022, value: 1005 },
      ],
    })
    const trend = analyzer.analyzeTrend('POP003')
    expect(trend.direction).toBe('STABLE')
  })

  it('이상치 탐지 — Z-score ≥ 2', () => {
    analyzer.registerSeries({
      ...risingSeries,
      seriesId: 'POP004',
      dataPoints: [
        { year: 2015, value: 100 },
        { year: 2016, value: 102 },
        { year: 2017, value: 98 },
        { year: 2018, value: 101 },
        { year: 2019, value: 99 },
        { year: 2020, value: 100 },
        { year: 2021, value: 103 },
        { year: 2022, value: 97 },
        { year: 2023, value: 101 },
        { year: 2024, value: 500 },  // 명백한 이상치
      ],
    })
    const outliers = analyzer.detectOutliers('POP004')
    expect(outliers.length).toBeGreaterThan(0)
    expect(outliers[0]?.year).toBe(2024)
  })

  it('인사이트 생성 — TREND, VOLATILITY, EXTREME 포함', () => {
    analyzer.registerSeries(risingSeries)
    const insights = analyzer.generateInsights('POP001')
    const categories = insights.map((i) => i.category)
    expect(categories).toContain('TREND')
    expect(categories).toContain('VOLATILITY')
    expect(categories).toContain('EXTREME')
  })

  it('미등록 시리즈 조회 시 에러', () => {
    expect(() => analyzer.analyzeTrend('UNKNOWN')).toThrow('Unknown series')
  })

  it('감사 로그 기록 확인', () => {
    analyzer.registerSeries(risingSeries)
    analyzer.analyzeTrend('POP001')
    analyzer.detectOutliers('POP001')
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'series.register')).toBe(true)
    expect(log.some((e) => e.action === 'trend.analyze')).toBe(true)
    expect(log.some((e) => e.action === 'outlier.detect')).toBe(true)
  })
})
