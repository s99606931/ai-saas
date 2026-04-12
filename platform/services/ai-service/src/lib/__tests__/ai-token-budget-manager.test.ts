/**
 * Tests — SVC-AI-ADV-R123 AI Token Budget Manager
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  AITokenBudgetManager,
  DataGrade,
  QuotaExceededError,
} from '../ai-token-budget-manager'

describe('AITokenBudgetManager — R123', () => {
  let mgr: AITokenBudgetManager

  beforeEach(() => {
    mgr = new AITokenBudgetManager()
    mgr.registerTenant('tenant-A', {
      minute: 1000,
      hour: 10_000,
      day: 100_000,
      month: 1_000_000,
    })
  })

  it('FR-R123.1: 테넌트 등록', () => {
    const r = mgr.getRemaining('tenant-A')
    expect(r.limits.minute).toBe(1000)
    expect(r.remaining.minute).toBe(1000)
  })

  it('등록 안된 테넌트 조회/소비 시 throw', () => {
    expect(() => mgr.getRemaining('unknown')).toThrow('Unknown tenant')
    expect(() =>
      mgr.consume({
        tenantId: 'unknown',
        model: 'gpt',
        inputTokens: 1,
        outputTokens: 1,
        grade: DataGrade.O,
      }),
    ).toThrow('Unknown tenant')
  })

  it('FR-R123.2: 토큰 소비 기록', () => {
    mgr.consume({
      tenantId: 'tenant-A',
      model: 'gpt',
      inputTokens: 100,
      outputTokens: 50,
      grade: DataGrade.O,
    })
    const r = mgr.getRemaining('tenant-A')
    expect(r.used.minute).toBe(150)
    expect(r.remaining.minute).toBe(850)
  })

  it('FR-R123.5: 모델 가중치', () => {
    mgr.setModelWeight({
      model: 'gpt-premium',
      inputMultiplier: 2,
      outputMultiplier: 4,
    })
    const rec = mgr.consume({
      tenantId: 'tenant-A',
      model: 'gpt-premium',
      inputTokens: 100,
      outputTokens: 50,
      grade: DataGrade.O,
    })
    // 100*2 + 50*4 = 400
    expect(rec.effectiveTokens).toBe(400)
  })

  it('FR-R123.4: 한도 초과 시 QuotaExceededError', () => {
    expect(() =>
      mgr.consume({
        tenantId: 'tenant-A',
        model: 'gpt',
        inputTokens: 1500,
        outputTokens: 0,
        grade: DataGrade.O,
      }),
    ).toThrow(QuotaExceededError)
  })

  it('FR-R123.4: QuotaExceededError에 window 정보', () => {
    try {
      mgr.consume({
        tenantId: 'tenant-A',
        model: 'gpt',
        inputTokens: 1500,
        outputTokens: 0,
        grade: DataGrade.O,
      })
      expect.fail('should throw')
    } catch (e) {
      expect(e).toBeInstanceOf(QuotaExceededError)
      const err = e as QuotaExceededError
      expect(err.window).toBe('minute')
      expect(err.limit).toBe(1000)
    }
  })

  it('FR-R123.3: 롤링 윈도우 — 1시간 전 기록은 minute에 미포함', () => {
    const now = Date.now()
    mgr.consume({
      tenantId: 'tenant-A',
      model: 'gpt',
      inputTokens: 500,
      outputTokens: 0,
      grade: DataGrade.O,
      timestamp: now - 120_000, // 2분 전
    })
    mgr.consume({
      tenantId: 'tenant-A',
      model: 'gpt',
      inputTokens: 200,
      outputTokens: 0,
      grade: DataGrade.O,
      timestamp: now,
    })
    const r = mgr.getRemaining('tenant-A')
    // minute: 200만, hour: 700
    expect(r.used.minute).toBe(200)
    expect(r.used.hour).toBe(700)
  })

  it('FR-R123.6: 경고 임계값 80% 초과 시 listener 호출', () => {
    const events: Array<{ window: string; utilization: number }> = []
    mgr.onWarning((evt) => events.push(evt))
    mgr.consume({
      tenantId: 'tenant-A',
      model: 'gpt',
      inputTokens: 850,
      outputTokens: 0,
      grade: DataGrade.O,
    })
    expect(events.some((e) => e.window === 'minute')).toBe(true)
    const minuteEvt = events.find((e) => e.window === 'minute')
    expect(minuteEvt?.utilization).toBeGreaterThanOrEqual(0.8)
  })

  it('경고 임계값 변경', () => {
    mgr.setWarningThreshold(0.5)
    const events: Array<{ window: string }> = []
    mgr.onWarning((evt) => events.push(evt))
    mgr.consume({
      tenantId: 'tenant-A',
      model: 'gpt',
      inputTokens: 600,
      outputTokens: 0,
      grade: DataGrade.O,
    })
    expect(events.some((e) => e.window === 'minute')).toBe(true)
  })

  it('잘못된 임계값', () => {
    expect(() => mgr.setWarningThreshold(0)).toThrow()
    expect(() => mgr.setWarningThreshold(1.5)).toThrow()
  })

  it('FR-R123.8: C등급 차단', () => {
    expect(() =>
      mgr.consume({
        tenantId: 'tenant-A',
        model: 'gpt',
        inputTokens: 10,
        outputTokens: 10,
        grade: DataGrade.C,
      }),
    ).toThrow('BLOCKED')
  })

  it('FR-R123.8: S등급 차단', () => {
    expect(() =>
      mgr.consume({
        tenantId: 'tenant-A',
        model: 'gpt',
        inputTokens: 10,
        outputTokens: 10,
        grade: DataGrade.S,
      }),
    ).toThrow('N2SF N-05')
  })

  it('음수 토큰 차단', () => {
    expect(() =>
      mgr.consume({
        tenantId: 'tenant-A',
        model: 'gpt',
        inputTokens: -1,
        outputTokens: 0,
        grade: DataGrade.O,
      }),
    ).toThrow()
  })

  it('FR-R123.7: getRemaining 반환 구조', () => {
    mgr.consume({
      tenantId: 'tenant-A',
      model: 'gpt',
      inputTokens: 100,
      outputTokens: 100,
      grade: DataGrade.O,
    })
    const r = mgr.getRemaining('tenant-A')
    expect(r.utilization.minute).toBeCloseTo(200 / 1000, 3)
    expect(r.remaining.day).toBe(100_000 - 200)
  })

  it('한도 미설정 window는 무한 잔여', () => {
    mgr.registerTenant('tenant-B', { minute: 100 })
    const r = mgr.getRemaining('tenant-B')
    expect(r.remaining.hour).toBe(Number.POSITIVE_INFINITY)
    expect(r.utilization.hour).toBe(0)
  })

  it('FR-R123.9: 감사 로그', () => {
    mgr.consume({
      tenantId: 'tenant-A',
      model: 'gpt',
      inputTokens: 10,
      outputTokens: 10,
      grade: DataGrade.O,
    })
    const log = mgr.getAuditLog()
    expect(log.some((e) => e.action === 'registerTenant')).toBe(true)
    expect(log.some((e) => e.action === 'consume')).toBe(true)
  })

  it('quotaExceeded 감사 로그', () => {
    try {
      mgr.consume({
        tenantId: 'tenant-A',
        model: 'gpt',
        inputTokens: 5000,
        outputTokens: 0,
        grade: DataGrade.O,
      })
    } catch {
      // expected
    }
    const log = mgr.getAuditLog()
    expect(log.some((e) => e.action === 'quotaExceeded')).toBe(true)
  })

  it('경고 listener 예외 흡수', () => {
    mgr.onWarning(() => {
      throw new Error('listener error')
    })
    expect(() =>
      mgr.consume({
        tenantId: 'tenant-A',
        model: 'gpt',
        inputTokens: 900,
        outputTokens: 0,
        grade: DataGrade.O,
      }),
    ).not.toThrow()
  })
})
