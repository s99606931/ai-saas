/**
 * Unit tests for FinOps AI Engine — SVC-AI-ADV-R93
 */

import { describe, it, expect, vi } from 'vitest'
import {
  FinopsAiEngine,
  type CostDataPoint,
  type BudgetPolicy,
  type AuditSink,
} from '../finops-ai-engine'

const mkSeries = (
  month: string,
  amounts: number[],
  category: CostDataPoint['category'] = 'LLM',
): CostDataPoint[] =>
  amounts.map((amount, i) => ({
    date: `${month}-${String(i + 1).padStart(2, '0')}`,
    amount,
    category,
  }))

describe('SVC-AI-ADV-R93 FinopsAiEngine', () => {
  it('[FR-R93.2] forecasts monthly projection from MTD', () => {
    const engine = new FinopsAiEngine()
    const series = mkSeries('2026-04', [100, 100, 100, 100, 100]) // 5일간 500원
    const policy: BudgetPolicy = {
      category: 'LLM',
      monthlyBudget: 5000,
    }
    // now = 2026-04-05 (5일 경과, 25일 남음)
    const now = new Date('2026-04-05T12:00:00Z')
    const result = engine.forecast(series, policy, now)
    expect(result.observedMtd).toBe(500)
    // daily avg = 100, projected = 500 + 100 * 25 = 3000
    expect(result.projectedMonthly).toBe(3000)
    expect(result.risk).toBe('SAFE')
  })

  it('[FR-R93.4] classifies DANGER when over budget', () => {
    const engine = new FinopsAiEngine()
    const series = mkSeries('2026-04', [1000, 1000, 1000, 1000, 1000])
    const policy: BudgetPolicy = {
      category: 'LLM',
      monthlyBudget: 5000,
    }
    const now = new Date('2026-04-05T12:00:00Z')
    const result = engine.forecast(series, policy, now)
    expect(result.risk).toBe('DANGER')
    expect(result.utilizationRatio).toBeGreaterThanOrEqual(1.0)
  })

  it('[FR-R93.4] classifies WARN between warnRatio and 1.0', () => {
    const engine = new FinopsAiEngine()
    // projected = 4400 at budget 5000, ratio = 0.88
    const series = mkSeries('2026-04', [200, 200, 200, 200, 200, 200, 200, 200, 200, 200])
    const policy: BudgetPolicy = {
      category: 'LLM',
      monthlyBudget: 5000,
      warnRatio: 0.8,
    }
    const now = new Date('2026-04-10T12:00:00Z')
    // NOTE: 첫 호출은 DANGER 전환 확인용(값 미사용), WARN 케이스는 policy2로 재계산
    engine.forecast(series, policy, now)
    // 2000 / 10 * 30 = 6000 → DANGER; let's adjust budget
    // actually daily=200, projected=200*30=6000 → DANGER
    // To hit WARN need projected 4000-5000
    const policy2: BudgetPolicy = {
      category: 'LLM',
      monthlyBudget: 7000,
      warnRatio: 0.8,
    }
    const result2 = engine.forecast(series, policy2, now)
    // projected 6000, budget 7000, ratio 0.857 → WARN
    expect(result2.risk).toBe('WARN')
  })

  it('[FR-R93.3] detects z-score anomalies', () => {
    const engine = new FinopsAiEngine({ anomalyThreshold: 1.5 })
    const series = mkSeries('2026-04', [100, 100, 100, 100, 100, 500])
    const anomalies = engine.detectAnomalies(series)
    expect(anomalies.length).toBeGreaterThan(0)
    expect(anomalies[0]!.amount).toBe(500)
  })

  it('[FR-R93.1] throws on empty series', () => {
    const engine = new FinopsAiEngine()
    expect(() =>
      engine.forecast([], { category: 'TOTAL', monthlyBudget: 1000 }),
    ).toThrow(/series/)
  })

  it('[FR-R93.1] filters by category', () => {
    const engine = new FinopsAiEngine()
    const series: CostDataPoint[] = [
      ...mkSeries('2026-04', [100, 100], 'LLM'),
      ...mkSeries('2026-04', [500, 500], 'INFRA'),
    ]
    const now = new Date('2026-04-02T12:00:00Z')
    const llm = engine.forecast(series, { category: 'LLM', monthlyBudget: 10000 }, now)
    expect(llm.observedMtd).toBe(200)
  })

  it('[FR-R93.5] forecastBatch logs audit', async () => {
    const audit: AuditSink = { log: vi.fn().mockResolvedValue(undefined) }
    const engine = new FinopsAiEngine({ audit })
    const series = mkSeries('2026-04', [100, 100])
    await engine.forecastBatch(
      series,
      [{ category: 'LLM', monthlyBudget: 10000 }],
      new Date('2026-04-02T12:00:00Z'),
    )
    expect(audit.log).toHaveBeenCalledWith(
      'finops.forecast.batch',
      expect.any(Object),
    )
  })
})
