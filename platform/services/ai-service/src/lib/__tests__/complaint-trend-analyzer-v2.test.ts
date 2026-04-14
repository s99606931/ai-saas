// Plan SC: SVC-AI-ADV-R558-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ComplaintTrendAnalyzerV2, type Complaint } from '../complaint-trend-analyzer-v2'

describe('ComplaintTrendAnalyzerV2', () => {
  let analyzer: ComplaintTrendAnalyzerV2

  const makeComplaint = (id: string, category: string, date: string, status: Complaint['status'] = 'RESOLVED', days: number | null = 5): Complaint => ({
    complaintId: id,
    category,
    subCategory: '일반',
    submittedAt: date,
    resolvedAt: status === 'RESOLVED' ? date : null,
    status,
    priority: 'MEDIUM',
    resolutionDays: days,
  })

  beforeEach(() => {
    analyzer = new ComplaintTrendAnalyzerV2()
  })

  it('민원 없을 때 트렌드 분석 → 빈 배열', () => {
    const trends = analyzer.analyzeTrend('MONTHLY')
    expect(trends).toHaveLength(0)
  })

  it('월별 트렌드 집계 정확', () => {
    analyzer.registerComplaint(makeComplaint('C1', '교통', '2026-01-05'))
    analyzer.registerComplaint(makeComplaint('C2', '교통', '2026-01-10'))
    analyzer.registerComplaint(makeComplaint('C3', '교통', '2026-02-03'))
    const trends = analyzer.analyzeTrend('MONTHLY')
    expect(trends.find((t) => t.period === '2026-01')?.count).toBe(2)
    expect(trends.find((t) => t.period === '2026-02')?.count).toBe(1)
  })

  it('증가율 계산 — 전 기간 대비', () => {
    analyzer.registerComplaint(makeComplaint('C1', '교통', '2026-01-05'))
    analyzer.registerComplaint(makeComplaint('C2', '교통', '2026-02-03'))
    analyzer.registerComplaint(makeComplaint('C3', '교통', '2026-02-10'))
    const trends = analyzer.analyzeTrend('MONTHLY')
    const feb = trends.find((t) => t.period === '2026-02')
    expect(feb?.growthRatePct).toBe(100) // 1 → 2 = 100% 증가
  })

  it('getTopCategories: 건수 기준 상위 반환', () => {
    analyzer.registerComplaint(makeComplaint('C1', '교통', '2026-01-01'))
    analyzer.registerComplaint(makeComplaint('C2', '교통', '2026-01-02'))
    analyzer.registerComplaint(makeComplaint('C3', '환경', '2026-01-03'))
    const top = analyzer.getTopCategories(2)
    expect(top[0]?.category).toBe('교통')
    expect(top).toHaveLength(2)
  })

  it('미해결 민원 카운트 정확', () => {
    analyzer.registerComplaint(makeComplaint('C1', '교통', '2026-01-01', 'OPEN', null))
    analyzer.registerComplaint(makeComplaint('C2', '교통', '2026-01-02', 'IN_PROGRESS', null))
    analyzer.registerComplaint(makeComplaint('C3', '교통', '2026-01-03', 'RESOLVED', 3))
    const report = analyzer.generateReport()
    expect(report.unresolvedCount).toBe(2)
  })

  it('generateReport: 총 민원 + 권고사항 반환', () => {
    for (let i = 0; i < 3; i++) {
      analyzer.registerComplaint(makeComplaint(`C${i}`, '교통', '2026-01-0' + (i + 1)))
    }
    const report = analyzer.generateReport()
    expect(report.totalComplaints).toBe(3)
    expect(report.generatedAt).toBeTruthy()
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    analyzer.registerComplaint(makeComplaint('C1', '교통', '2026-01-01'))
    analyzer.generateReport()
    const log1 = analyzer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', complaintId: 'X', detail: {} })
    const log2 = analyzer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
