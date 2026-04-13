// Plan SC: SVC-AI-ADV-R396-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { AutoSLAReportGeneratorAI, type SLAMetric } from '../auto-sla-report-generator-ai'

describe('AutoSLAReportGeneratorAI', () => {
  let generator: AutoSLAReportGeneratorAI

  beforeEach(() => {
    generator = new AutoSLAReportGeneratorAI()
  })

  const excellentMetric: SLAMetric = {
    serviceId: 'SVC1',
    period: 'MONTHLY',
    availabilityRate: 0.9995,
    avgResponseTimeMs: 100,
    p99ResponseTimeMs: 250,
    errorRate: 0.0005,
    incidentCount: 0,
    mttrMin: 0,
  }

  it('수집 메트릭 없을 때 F등급 반환', () => {
    const result = generator.generateReport('SVC1', 'MONTHLY')
    expect(result.grade).toBe('F')
  })

  it('우수 지표 → A등급', () => {
    generator.ingestMetric(excellentMetric)
    const result = generator.generateReport('SVC1', 'MONTHLY')
    expect(result.grade).toBe('A')
  })

  it('저조 지표 → D 또는 F등급', () => {
    generator.ingestMetric({
      ...excellentMetric,
      availabilityRate: 0.92,
      avgResponseTimeMs: 3000,
      errorRate: 0.08,
      incidentCount: 5,
      mttrMin: 120,
    })
    const result = generator.generateReport('SVC1', 'MONTHLY')
    expect(['D', 'F']).toContain(result.grade)
  })

  it('개선 추세 탐지: 이전 대비 가용성 향상', () => {
    generator.ingestMetric({ ...excellentMetric, availabilityRate: 0.95, avgResponseTimeMs: 800, errorRate: 0.04 })
    generator.ingestMetric({ ...excellentMetric, availabilityRate: 0.999, avgResponseTimeMs: 100, errorRate: 0.001 })
    const result = generator.generateReport('SVC1', 'MONTHLY')
    expect(result.trendVsPreviousPeriod).toBe('IMPROVED')
  })

  it('저하 추세 탐지: 이전 대비 가용성 하락', () => {
    generator.ingestMetric({ ...excellentMetric, availabilityRate: 0.999, avgResponseTimeMs: 100, errorRate: 0.001 })
    generator.ingestMetric({ ...excellentMetric, availabilityRate: 0.92, avgResponseTimeMs: 2000, errorRate: 0.06 })
    const result = generator.generateReport('SVC1', 'MONTHLY')
    expect(result.trendVsPreviousPeriod).toBe('DEGRADED')
  })

  it('STABLE 추세: 동일 지표 2회', () => {
    generator.ingestMetric({ ...excellentMetric })
    generator.ingestMetric({ ...excellentMetric })
    const result = generator.generateReport('SVC1', 'MONTHLY')
    expect(result.trendVsPreviousPeriod).toBe('STABLE')
  })

  it('보고서에 serviceId, period, summary 포함', () => {
    generator.ingestMetric(excellentMetric)
    const result = generator.generateReport('SVC1', 'MONTHLY')
    expect(result.serviceId).toBe('SVC1')
    expect(result.period).toBe('MONTHLY')
    expect(result.summary).toContain('SVC1')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    generator.ingestMetric(excellentMetric)
    generator.generateReport('SVC1', 'MONTHLY')
    const log1 = generator.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = generator.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
