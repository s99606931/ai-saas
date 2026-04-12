/**
 * Tests — SVC-AI-ADV-R144 Tenant Billing Reporter
 */

import { describe, it, expect } from 'vitest'
import { TenantBillingReporter } from '../tenant-billing-reporter'

function makeReporter() {
  let t = 1_700_000_000_000
  return new TenantBillingReporter({
    now: () => {
      t += 1
      return t
    },
  })
}

describe('TenantBillingReporter', () => {
  it('기본 리포트 계산', () => {
    const r = makeReporter()
    r.setRate({
      modelId: 'gpt-4',
      inputPerK: 30,
      outputPerK: 60,
      currency: 'KRW',
    })
    r.record({
      tenantId: 't1',
      modelId: 'gpt-4',
      inputTokens: 1000,
      outputTokens: 2000,
      at: 100,
    })
    const rep = r.generate('t1', 0, 200)
    expect(rep.lines.length).toBe(1)
    expect(rep.lines[0]!.grossAmount).toBe(150) // 30 + 120
    expect(rep.totalNet).toBe(150)
  })

  it('할인율 적용', () => {
    const r = makeReporter()
    r.setRate({
      modelId: 'm',
      inputPerK: 10,
      outputPerK: 20,
      currency: 'KRW',
    })
    r.setDiscount('t1', 0.1)
    r.record({
      tenantId: 't1',
      modelId: 'm',
      inputTokens: 1000,
      outputTokens: 1000,
      at: 50,
    })
    const rep = r.generate('t1', 0, 100)
    expect(rep.totalGross).toBe(30)
    expect(rep.totalDiscount).toBe(3)
    expect(rep.totalNet).toBe(27)
  })

  it('기간 필터링', () => {
    const r = makeReporter()
    r.setRate({
      modelId: 'm',
      inputPerK: 10,
      outputPerK: 10,
      currency: 'KRW',
    })
    r.record({
      tenantId: 't1',
      modelId: 'm',
      inputTokens: 1000,
      outputTokens: 0,
      at: 50,
    })
    r.record({
      tenantId: 't1',
      modelId: 'm',
      inputTokens: 1000,
      outputTokens: 0,
      at: 500,
    })
    const rep = r.generate('t1', 0, 100)
    expect(rep.lines[0]!.inputTokens).toBe(1000)
  })

  it('테넌트 분리', () => {
    const r = makeReporter()
    r.setRate({
      modelId: 'm',
      inputPerK: 10,
      outputPerK: 10,
      currency: 'KRW',
    })
    r.record({
      tenantId: 't1',
      modelId: 'm',
      inputTokens: 1000,
      outputTokens: 0,
      at: 50,
    })
    r.record({
      tenantId: 't2',
      modelId: 'm',
      inputTokens: 2000,
      outputTokens: 0,
      at: 50,
    })
    expect(r.generate('t1', 0, 100).totalNet).toBe(10)
    expect(r.generate('t2', 0, 100).totalNet).toBe(20)
  })

  it('단가 미등록 오류', () => {
    const r = makeReporter()
    r.record({
      tenantId: 't',
      modelId: 'ghost',
      inputTokens: 100,
      outputTokens: 0,
      at: 1,
    })
    expect(() => r.generate('t', 0, 10)).toThrow('rate_missing')
  })

  it('할인율 범위 검증', () => {
    const r = makeReporter()
    expect(() => r.setDiscount('t', 0.6)).toThrow('invalid_discount')
    expect(() => r.setDiscount('t', -0.1)).toThrow('invalid_discount')
  })

  it('잘못된 기간', () => {
    const r = makeReporter()
    expect(() => r.generate('t', 100, 10)).toThrow('invalid_period')
  })

  it('음수 토큰 거부', () => {
    const r = makeReporter()
    expect(() =>
      r.record({
        tenantId: 't',
        modelId: 'm',
        inputTokens: -1,
        outputTokens: 0,
        at: 1,
      }),
    ).toThrow('invalid_tokens')
  })

  it('빈 레코드 거부', () => {
    const r = makeReporter()
    expect(() =>
      r.record({
        tenantId: '',
        modelId: 'm',
        inputTokens: 0,
        outputTokens: 0,
        at: 1,
      }),
    ).toThrow('invalid_record')
  })

  it('C/S등급 차단', () => {
    const r = makeReporter()
    expect(() =>
      r.record(
        {
          tenantId: 't',
          modelId: 'm',
          inputTokens: 1,
          outputTokens: 0,
          at: 1,
        },
        'C',
      ),
    ).toThrow('grade_blocked')
  })

  it('다중 모델 합산', () => {
    const r = makeReporter()
    r.setRate({
      modelId: 'm1',
      inputPerK: 10,
      outputPerK: 10,
      currency: 'KRW',
    })
    r.setRate({
      modelId: 'm2',
      inputPerK: 20,
      outputPerK: 20,
      currency: 'KRW',
    })
    r.record({
      tenantId: 't',
      modelId: 'm1',
      inputTokens: 1000,
      outputTokens: 0,
      at: 1,
    })
    r.record({
      tenantId: 't',
      modelId: 'm2',
      inputTokens: 1000,
      outputTokens: 0,
      at: 2,
    })
    const rep = r.generate('t', 0, 10)
    expect(rep.lines.length).toBe(2)
    expect(rep.totalNet).toBe(30)
  })

  it('음수 단가 거부', () => {
    const r = makeReporter()
    expect(() =>
      r.setRate({
        modelId: 'm',
        inputPerK: -1,
        outputPerK: 0,
        currency: 'KRW',
      }),
    ).toThrow('invalid_rate')
  })

  it('getAuditLog', () => {
    const r = makeReporter()
    r.setRate({
      modelId: 'm',
      inputPerK: 1,
      outputPerK: 1,
      currency: 'KRW',
    })
    r.record({
      tenantId: 't',
      modelId: 'm',
      inputTokens: 1,
      outputTokens: 1,
      at: 1,
    })
    r.generate('t', 0, 10)
    const log = r.getAuditLog()
    expect(log.some((e) => e.event === 'rate_set')).toBe(true)
    expect(log.some((e) => e.event === 'report_generated')).toBe(true)
  })
})
