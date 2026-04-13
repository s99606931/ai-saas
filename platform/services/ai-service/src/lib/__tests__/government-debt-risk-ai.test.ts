import { describe, it, expect, beforeEach } from 'vitest'
import { GovernmentDebtRiskAi } from '../government-debt-risk-ai.js'

describe('GovernmentDebtRiskAi (FR-R510.1)', () => {
  let svc: GovernmentDebtRiskAi

  beforeEach(() => {
    svc = new GovernmentDebtRiskAi()
  })

  it('안정적 부채 → STABLE', () => {
    svc.recordSnapshot(
      {
        fiscalYear: 2025,
        totalDebtKRW: 100,
        gdpKRW: 1000,
        annualInterestKRW: 2,
        annualRevenueKRW: 200,
        shortTermDebtKRW: 10,
      },
      'O'
    )
    const r = svc.evaluate(2025)
    expect(r.riskLevel).toBe('STABLE')
    expect(r.debtToGdpPct).toBe(10)
  })

  it('GDP 대비 60% 이상 → HIGH_DEBT_TO_GDP', () => {
    svc.recordSnapshot(
      {
        fiscalYear: 2026,
        totalDebtKRW: 700,
        gdpKRW: 1000,
        annualInterestKRW: 30,
        annualRevenueKRW: 200,
        shortTermDebtKRW: 100,
      },
      'O'
    )
    const r = svc.evaluate(2026)
    expect(r.flags).toContain('HIGH_DEBT_TO_GDP')
    expect(['WARNING', 'CRITICAL']).toContain(r.riskLevel)
  })

  it('단기부채 비중 30% 이상 → SHORT_TERM_REFINANCING_RISK', () => {
    svc.recordSnapshot(
      {
        fiscalYear: 2027,
        totalDebtKRW: 500,
        gdpKRW: 2000,
        annualInterestKRW: 10,
        annualRevenueKRW: 300,
        shortTermDebtKRW: 200,
      },
      'O'
    )
    const r = svc.evaluate(2027)
    expect(r.flags).toContain('SHORT_TERM_REFINANCING_RISK')
  })

  it('급증 추세 → RAPID_DEBT_GROWTH', () => {
    svc.recordSnapshot(
      {
        fiscalYear: 2024,
        totalDebtKRW: 400,
        gdpKRW: 1000,
        annualInterestKRW: 20,
        annualRevenueKRW: 200,
        shortTermDebtKRW: 50,
      },
      'O'
    )
    svc.recordSnapshot(
      {
        fiscalYear: 2025,
        totalDebtKRW: 500,
        gdpKRW: 1000,
        annualInterestKRW: 25,
        annualRevenueKRW: 200,
        shortTermDebtKRW: 60,
      },
      'O'
    )
    const r = svc.evaluate(2025)
    expect(r.flags).toContain('RAPID_DEBT_GROWTH')
  })

  it('잘못된 입력 거부', () => {
    expect(() =>
      svc.recordSnapshot(
        {
          fiscalYear: 2026,
          totalDebtKRW: -1,
          gdpKRW: 1000,
          annualInterestKRW: 10,
          annualRevenueKRW: 100,
          shortTermDebtKRW: 0,
        },
        'O'
      )
    ).toThrow(/totalDebtKRW/)
    expect(() =>
      svc.recordSnapshot(
        {
          fiscalYear: 2028,
          totalDebtKRW: 100,
          gdpKRW: 1000,
          annualInterestKRW: 10,
          annualRevenueKRW: 100,
          shortTermDebtKRW: 200,
        },
        'O'
      )
    ).toThrow(/shortTermDebtKRW/)
  })

  it('S 등급 차단 + 감사 로그', () => {
    expect(() =>
      svc.recordSnapshot(
        {
          fiscalYear: 2026,
          totalDebtKRW: 100,
          gdpKRW: 1000,
          annualInterestKRW: 5,
          annualRevenueKRW: 100,
          shortTermDebtKRW: 10,
        },
        'S'
      )
    ).toThrow(/BLOCKED/)
    svc.recordSnapshot(
      {
        fiscalYear: 2026,
        totalDebtKRW: 100,
        gdpKRW: 1000,
        annualInterestKRW: 5,
        annualRevenueKRW: 100,
        shortTermDebtKRW: 10,
      },
      'O'
    )
    svc.evaluate(2026)
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
