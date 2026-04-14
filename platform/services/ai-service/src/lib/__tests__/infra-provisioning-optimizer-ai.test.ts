// Plan SC: SVC-AI-ADV-R523-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { InfraProvisioningOptimizerAI, type ResourceSpec } from '../infra-provisioning-optimizer-ai'

describe('InfraProvisioningOptimizerAI', () => {
  let optimizer: InfraProvisioningOptimizerAI

  const baseResource: ResourceSpec = {
    resourceId: 'RES-1',
    serviceId: 'SVC-1',
    resourceType: 'COMPUTE',
    provider: 'ON_PREM',
    currentCpuPct: 15,
    currentMemoryPct: 18,
    currentStoragePct: 50,
    currentCostKrwPerHour: 10_000,
    requestedCpuPct: 15,
    requestedMemoryPct: 18,
  }

  beforeEach(() => {
    optimizer = new InfraProvisioningOptimizerAI()
  })

  it('리소스 없을 때 → 권고사항=0', () => {
    const report = optimizer.optimize()
    expect(report.recommendations).toHaveLength(0)
    expect(report.totalResources).toBe(0)
  })

  it('CPU/메모리 사용률 20% 미만 → SCALE_DOWN 권고', () => {
    optimizer.registerResource(baseResource)
    const report = optimizer.optimize()
    expect(report.recommendations.some((r) => r.action === 'SCALE_DOWN' && r.resourceId === 'RES-1')).toBe(true)
    expect(report.overProvisionedCount).toBeGreaterThan(0)
  })

  it('CPU 85% 초과 → SCALE_OUT 권고 (COMPUTE)', () => {
    optimizer.registerResource({ ...baseResource, resourceId: 'RES-HIGH', currentCpuPct: 90, requestedCpuPct: 90, requestedMemoryPct: 85 })
    const report = optimizer.optimize()
    expect(report.recommendations.some((r) => r.action === 'SCALE_OUT' && r.resourceId === 'RES-HIGH')).toBe(true)
    expect(report.underProvisionedCount).toBeGreaterThan(0)
  })

  it('고사용률 STORAGE → SCALE_UP 권고', () => {
    optimizer.registerResource({ ...baseResource, resourceId: 'RES-DB', resourceType: 'DATABASE', currentCpuPct: 88, requestedCpuPct: 88, requestedMemoryPct: 82 })
    const report = optimizer.optimize()
    expect(report.recommendations.some((r) => r.action === 'SCALE_UP' && r.resourceId === 'RES-DB')).toBe(true)
  })

  it('estimatedMonthlySavingKrw 합산 정확', () => {
    optimizer.registerResource(baseResource)
    const report = optimizer.optimize()
    const sum = report.recommendations.reduce((s, r) => s + r.estimatedSavingKrw, 0)
    expect(report.estimatedMonthlySavingKrw).toBe(sum)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    optimizer.registerResource(baseResource)
    optimizer.optimize()
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', resourceId: 'X', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
