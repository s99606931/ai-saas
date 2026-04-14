// Plan SC: SVC-AI-ADV-R486-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceCostAnomalyDetectorV3, type CostEntry } from '../service-cost-anomaly-detector-v3'

describe('ServiceCostAnomalyDetectorV3', () => {
  let detector: ServiceCostAnomalyDetectorV3

  beforeEach(() => {
    detector = new ServiceCostAnomalyDetectorV3()
  })

  it('데이터 없을 때 → anomalies=0, overBudget=false', () => {
    const report = detector.detect('SVC-1', '2026-04')
    expect(report.anomalies).toHaveLength(0)
    expect(report.overBudget).toBe(false)
  })

  it('전월 대비 50% 이상 급증 → CRITICAL 이상 탐지', () => {
    detector.ingestEntry({ entryId: 'E1', serviceId: 'SVC-1', category: 'COMPUTE', month: '2026-03', amountKrw: 100_000, budgetKrw: 200_000 })
    detector.ingestEntry({ entryId: 'E2', serviceId: 'SVC-1', category: 'COMPUTE', month: '2026-04', amountKrw: 160_000, budgetKrw: 200_000 })
    const report = detector.detect('SVC-1', '2026-04')
    expect(report.anomalies.some((a) => a.severity === 'CRITICAL')).toBe(true)
  })

  it('전월 대비 20~49% 증가 → WARNING 이상 탐지', () => {
    detector.ingestEntry({ entryId: 'E1', serviceId: 'SVC-2', category: 'STORAGE', month: '2026-03', amountKrw: 100_000, budgetKrw: 200_000 })
    detector.ingestEntry({ entryId: 'E2', serviceId: 'SVC-2', category: 'STORAGE', month: '2026-04', amountKrw: 130_000, budgetKrw: 200_000 })
    const report = detector.detect('SVC-2', '2026-04')
    expect(report.anomalies.some((a) => a.severity === 'WARNING')).toBe(true)
  })

  it('예산 10% 초과 → CRITICAL 이상 탐지, overBudget=true', () => {
    detector.ingestEntry({ entryId: 'E1', serviceId: 'SVC-3', category: 'NETWORK', month: '2026-04', amountKrw: 120_000, budgetKrw: 100_000 })
    const report = detector.detect('SVC-3', '2026-04')
    expect(report.anomalies.some((a) => a.severity === 'CRITICAL' && a.deviationPercent > 0)).toBe(true)
    expect(report.overBudget).toBe(true)
  })

  it('totalActualKrw, totalBudgetKrw 합산 정확', () => {
    detector.ingestEntry({ entryId: 'E1', serviceId: 'SVC-4', category: 'COMPUTE', month: '2026-04', amountKrw: 50_000, budgetKrw: 100_000 })
    detector.ingestEntry({ entryId: 'E2', serviceId: 'SVC-4', category: 'STORAGE', month: '2026-04', amountKrw: 30_000, budgetKrw: 50_000 })
    const report = detector.detect('SVC-4', '2026-04')
    expect(report.totalActualKrw).toBe(80_000)
    expect(report.totalBudgetKrw).toBe(150_000)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    detector.ingestEntry({ entryId: 'E1', serviceId: 'SVC-5', category: 'COMPUTE', month: '2026-04', amountKrw: 50_000, budgetKrw: 100_000 })
    detector.detect('SVC-5', '2026-04')
    const log1 = detector.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = detector.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
