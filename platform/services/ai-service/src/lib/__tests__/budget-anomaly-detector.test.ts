import { describe, it, expect, beforeEach } from 'vitest'
import { BudgetAnomalyDetector } from '../budget-anomaly-detector'

describe('BudgetAnomalyDetector', () => {
  let detector: BudgetAnomalyDetector

  beforeEach(() => {
    detector = new BudgetAnomalyDetector()
    detector.registerItem({ itemId: 'IT-001', department: '정보화팀', annualBudget: 10000000, name: 'IT 장비' })
  })

  it('알 수 없는 항목 지출 기록 시 오류', () => {
    expect(() => detector.recordExpenditure({ itemId: 'UNKNOWN', date: '2026-01-01', amount: 1000, description: '테스트' })).toThrow('Unknown item')
  })

  it('지출 2건 미만 시 이상 탐지 빈 배열', () => {
    detector.recordExpenditure({ itemId: 'IT-001', date: '2026-01-01', amount: 500000, description: '구매' })
    expect(detector.detectAnomalies('IT-001')).toEqual([])
  })

  it('Z-score > 2.0 이상 지출 탐지', () => {
    // 기본 낮은 지출 10건 + 이상 지출 1건
    for (let i = 0; i < 10; i++) {
      detector.recordExpenditure({ itemId: 'IT-001', date: `2026-01-${String(i + 1).padStart(2, '0')}`, amount: 100000, description: '정상' })
    }
    detector.recordExpenditure({ itemId: 'IT-001', date: '2026-02-01', amount: 5000000, description: '대규모 지출' })
    const anomalies = detector.detectAnomalies('IT-001')
    expect(anomalies.length).toBeGreaterThan(0)
    expect(anomalies[0]!.zScore).toBeGreaterThan(2.0)
  })

  it('집행률 계산', () => {
    detector.recordExpenditure({ itemId: 'IT-001', date: '2026-01-01', amount: 2500000, description: '1분기' })
    const report = detector.getReport('IT-001')
    expect(report.executionRate).toBeCloseTo(0.25)
    expect(report.totalSpent).toBe(2500000)
  })

  it('알 수 없는 항목 리포트 시 오류', () => {
    expect(() => detector.getReport('UNKNOWN')).toThrow('Unknown item')
  })

  it('감사 로그 복사본 반환', () => {
    detector.recordExpenditure({ itemId: 'IT-001', date: '2026-01-01', amount: 100000, description: '구매' })
    const log = detector.getAuditLog()
    log.push({ timestamp: '', action: 'injected', itemId: 'X', detail: {} })
    expect(detector.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
