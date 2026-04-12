import { describe, it, expect, beforeEach } from 'vitest'
import { ProcurementRiskAssessorAI } from '../procurement-risk-assessor-ai'

describe('ProcurementRiskAssessorAI', () => {
  let assessor: ProcurementRiskAssessorAI

  beforeEach(() => {
    assessor = new ProcurementRiskAssessorAI()
    assessor.registerItem({ itemId: 'IT-1', name: 'SW 라이선스', estimatedBudget: 500000000, category: 'IT', vendorCount: 3, isEmergency: false })
  })

  it('알 수 없는 항목 평가 시 오류', () => {
    expect(() => assessor.assess('UNKNOWN')).toThrow('Unknown item')
  })

  it('정상 조달 — LOW 리스크', () => {
    assessor.recordBid({ itemId: 'IT-1', bidId: 'B-1', vendorId: 'V-1', bidPrice: 450000000, technicalScore: 85 })
    assessor.recordBid({ itemId: 'IT-1', bidId: 'B-2', vendorId: 'V-2', bidPrice: 460000000, technicalScore: 80 })
    assessor.recordBid({ itemId: 'IT-1', bidId: 'B-3', vendorId: 'V-3', bidPrice: 470000000, technicalScore: 78 })
    const result = assessor.assess('IT-1')
    expect(result.riskLevel).toBe('LOW')
  })

  it('입찰 경쟁 부족 — 리스크 상승', () => {
    const result = assessor.assess('IT-1')
    expect(result.riskFactors.some((f) => f.includes('경쟁'))).toBe(true)
    expect(result.riskScore).toBeGreaterThan(0)
  })

  it('긴급 조달 — 리스크 요인 포함', () => {
    assessor.registerItem({ itemId: 'IT-2', name: '긴급 장비', estimatedBudget: 100000000, category: 'IT', vendorCount: 2, isEmergency: true })
    const result = assessor.assess('IT-2')
    expect(result.riskFactors.some((f) => f.includes('긴급'))).toBe(true)
  })

  it('덤핑 의심 낙찰 — 리스크 요인 포함', () => {
    assessor.recordBid({ itemId: 'IT-1', bidId: 'B-1', vendorId: 'V-1', bidPrice: 450000000, technicalScore: 85 })
    assessor.recordBid({ itemId: 'IT-1', bidId: 'B-2', vendorId: 'V-2', bidPrice: 100000000, technicalScore: 70 })
    const result = assessor.assess('IT-1')
    expect(result.riskFactors.some((f) => f.includes('덤핑'))).toBe(true)
  })

  it('감사 로그 복사본 반환', () => {
    assessor.assess('IT-1')
    const log = assessor.getAuditLog()
    log.push({ timestamp: '', action: 'injected', itemId: 'X', detail: {} })
    expect(assessor.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
