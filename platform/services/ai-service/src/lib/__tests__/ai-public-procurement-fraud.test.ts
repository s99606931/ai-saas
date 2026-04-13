import { describe, it, expect, beforeEach } from 'vitest'
import { AiPublicProcurementFraud } from '../ai-public-procurement-fraud.js'

describe('AiPublicProcurementFraud (FR-R503.1)', () => {
  let svc: AiPublicProcurementFraud

  beforeEach(() => {
    svc = new AiPublicProcurementFraud()
  })

  it('단독 입찰 → SINGLE_BID 플래그', () => {
    svc.registerCase(
      {
        caseId: 'C1',
        estimatedValue: 1000,
        bids: [{ bidId: 'b1', vendorId: 'v1', amount: 950, submittedAt: '2026-01-01T10:00:00Z' }],
        winnerBidId: 'b1',
      },
      'O'
    )
    const r = svc.analyze('C1')
    expect(r.flags).toContain('SINGLE_BID')
  })

  it('가격 클러스터링 → PRICE_CLUSTERING + HIGH', () => {
    svc.registerCase(
      {
        caseId: 'C2',
        estimatedValue: 1000,
        bids: [
          { bidId: 'b1', vendorId: 'v1', amount: 990, submittedAt: '2026-01-01T10:00:00Z' },
          { bidId: 'b2', vendorId: 'v2', amount: 991, submittedAt: '2026-01-01T11:00:00Z' },
          { bidId: 'b3', vendorId: 'v3', amount: 989, submittedAt: '2026-01-01T12:00:00Z' },
        ],
        winnerBidId: 'b3',
      },
      'O'
    )
    const r = svc.analyze('C2')
    expect(r.flags).toContain('PRICE_CLUSTERING')
    expect(['HIGH', 'CRITICAL']).toContain(r.risk)
  })

  it('동일 시각 제출 → SAME_SUBMIT_TIME', () => {
    svc.registerCase(
      {
        caseId: 'C3',
        estimatedValue: 1000,
        bids: [
          { bidId: 'b1', vendorId: 'v1', amount: 800, submittedAt: '2026-01-01T10:00:00Z' },
          { bidId: 'b2', vendorId: 'v2', amount: 600, submittedAt: '2026-01-01T10:00:00Z' },
        ],
        winnerBidId: 'b2',
      },
      'O'
    )
    const r = svc.analyze('C3')
    expect(r.flags).toContain('SAME_SUBMIT_TIME')
  })

  it('정상 입찰 → LOW', () => {
    svc.registerCase(
      {
        caseId: 'C4',
        estimatedValue: 1000,
        bids: [
          { bidId: 'b1', vendorId: 'v1', amount: 850, submittedAt: '2026-01-01T10:00:00Z' },
          { bidId: 'b2', vendorId: 'v2', amount: 750, submittedAt: '2026-01-01T11:00:00Z' },
          { bidId: 'b3', vendorId: 'v3', amount: 800, submittedAt: '2026-01-01T12:00:00Z' },
        ],
        winnerBidId: 'b2',
      },
      'O'
    )
    const r = svc.analyze('C4')
    expect(r.risk).toBe('LOW')
  })

  it('C 등급 차단', () => {
    expect(() =>
      svc.registerCase(
        {
          caseId: 'C5',
          estimatedValue: 100,
          bids: [],
        },
        'C'
      )
    ).toThrow(/BLOCKED/)
  })

  it('감사 로그 기록', () => {
    svc.registerCase(
      {
        caseId: 'C6',
        estimatedValue: 100,
        bids: [{ bidId: 'b1', vendorId: 'v1', amount: 95, submittedAt: '2026-01-01T10:00:00Z' }],
        winnerBidId: 'b1',
      },
      'O'
    )
    svc.analyze('C6')
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
