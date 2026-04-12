import { describe, it, expect, beforeEach } from 'vitest'
import { PublicProcurementAutomationAi, type ProcurementRequest } from '../public-procurement-automation-ai'

describe('PublicProcurementAutomationAi', () => {
  let ai: PublicProcurementAutomationAi

  const baseRequest: ProcurementRequest = {
    requestId: 'PR001',
    title: '행정 시스템 유지보수',
    department: '정보화팀',
    estimatedAmount: 50_000_000,
    procurementType: 'GENERAL',
    urgency: false,
    vendorCount: 3,
    description: '연간 유지보수 계약',
  }

  beforeEach(() => {
    ai = new PublicProcurementAutomationAi()
  })

  it('요청 제출 후 검토 가능', () => {
    ai.submitRequest(baseRequest)
    const review = ai.review('PR001')
    expect(review.requestId).toBe('PR001')
  })

  it('정상 요청 → LOW 리스크', () => {
    ai.submitRequest(baseRequest)
    const review = ai.review('PR001')
    expect(review.riskLevel).toBe('LOW')
    expect(review.status).toBe('APPROVED')
  })

  it('1억 원 이상 → 위원회 심의 필요', () => {
    ai.submitRequest({ ...baseRequest, requestId: 'PR002', estimatedAmount: 150_000_000 })
    const review = ai.review('PR002')
    expect(review.requiresCommitteeApproval).toBe(true)
  })

  it('수의계약 → HIGH 리스크', () => {
    ai.submitRequest({ ...baseRequest, requestId: 'PR003', procurementType: 'SOLE_SOURCE', vendorCount: 1 })
    const review = ai.review('PR003')
    expect(['HIGH', 'VERY_HIGH']).toContain(review.riskLevel)
  })

  it('긴급 + 단독 입찰 → VERY_HIGH 리스크', () => {
    ai.submitRequest({
      ...baseRequest,
      requestId: 'PR004',
      procurementType: 'EMERGENCY',
      urgency: true,
      vendorCount: 1,
      estimatedAmount: 600_000_000,
    })
    const review = ai.review('PR004')
    expect(review.riskLevel).toBe('VERY_HIGH')
    expect(review.status).toBe('REVIEW')
  })

  it('금액 0 이하 에러', () => {
    expect(() => ai.submitRequest({ ...baseRequest, requestId: 'PR_INVALID', estimatedAmount: 0 })).toThrow()
  })

  it('미등록 요청 검토 에러', () => {
    expect(() => ai.review('UNKNOWN')).toThrow()
  })

  it('이슈 목록 반환', () => {
    ai.submitRequest({ ...baseRequest, requestId: 'PR005', vendorCount: 1, urgency: true })
    const review = ai.review('PR005')
    expect(review.issues.length).toBeGreaterThan(0)
  })

  it('검토 후 감사 로그', () => {
    ai.submitRequest(baseRequest)
    ai.review('PR001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'request.review')).toBe(true)
  })
})
