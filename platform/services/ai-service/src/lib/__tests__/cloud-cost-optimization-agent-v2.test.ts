// Plan SC: SVC-AI-ADV-R559-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { CloudCostOptimizationAgentV2, type CloudResource } from '../cloud-cost-optimization-agent-v2'

describe('CloudCostOptimizationAgentV2', () => {
  let agent: CloudCostOptimizationAgentV2

  const baseResource: CloudResource = {
    resourceId: 'VM-1',
    serviceId: 'SVC-1',
    resourceType: 'VM',
    provider: 'KT_CLOUD',
    cpuUsagePct: 50,
    memoryUsagePct: 55,
    storageUsagePct: 40,
    costKrwPerHour: 5_000,
    isReserved: false,
    uptimeDays: 30,
  }

  beforeEach(() => {
    agent = new CloudCostOptimizationAgentV2()
  })

  it('자원 없을 때 → 권고사항=0', () => {
    const report = agent.analyze()
    expect(report.recommendations).toHaveLength(0)
    expect(report.totalResources).toBe(0)
  })

  it('CPU<10% AND 메모리<15% → TERMINATE 권고, idleCount=1', () => {
    agent.registerResource({ ...baseResource, resourceId: 'VM-IDLE', cpuUsagePct: 5, memoryUsagePct: 10 })
    const report = agent.analyze()
    expect(report.recommendations.some((r) => r.action === 'TERMINATE' && r.resourceId === 'VM-IDLE')).toBe(true)
    expect(report.idleCount).toBe(1)
  })

  it('CPU<30% AND 메모리<40% → DOWNSIZE 권고', () => {
    agent.registerResource({ ...baseResource, resourceId: 'VM-UNDER', cpuUsagePct: 20, memoryUsagePct: 30 })
    const report = agent.analyze()
    expect(report.recommendations.some((r) => r.action === 'DOWNSIZE' && r.resourceId === 'VM-UNDER')).toBe(true)
    expect(report.underutilizedCount).toBe(1)
  })

  it('장기 운영 + 예약 미적용 → RESERVE 권고', () => {
    agent.registerResource({ ...baseResource, resourceId: 'VM-LONG', uptimeDays: 120, isReserved: false, cpuUsagePct: 60 })
    const report = agent.analyze()
    expect(report.recommendations.some((r) => r.action === 'RESERVE' && r.resourceId === 'VM-LONG')).toBe(true)
  })

  it('총 예상 절감 비용 합산 정확', () => {
    agent.registerResource({ ...baseResource, resourceId: 'VM-IDLE2', cpuUsagePct: 5, memoryUsagePct: 10 })
    const report = agent.analyze()
    const sum = report.recommendations.reduce((s, r) => s + r.estimatedMonthlySavingKrw, 0)
    expect(report.totalEstimatedMonthlySavingKrw).toBe(sum)
  })

  it('예약된 자원 → 최적화 권고 없음 (정상 사용)', () => {
    agent.registerResource({ ...baseResource, resourceId: 'VM-RES', isReserved: true, uptimeDays: 200, cpuUsagePct: 60 })
    const report = agent.analyze()
    expect(report.recommendations.some((r) => r.resourceId === 'VM-RES')).toBe(false)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    agent.registerResource(baseResource)
    agent.analyze()
    const log1 = agent.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', resourceId: 'X', detail: {} })
    const log2 = agent.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
