// Plan SC: SVC-AI-ADV-R492-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentFaultIsolatorV2, type ServiceHealth } from '../intelligent-fault-isolator-v2'

describe('IntelligentFaultIsolatorV2', () => {
  let isolator: IntelligentFaultIsolatorV2

  const healthyMetric: ServiceHealth = {
    serviceId: 'SVC-1',
    timestamp: Date.now(),
    latencyP99Ms: 200,
    errorRatePct: 0.5,
    cpuUsagePct: 40,
    memoryUsagePct: 60,
    activeConnections: 100,
  }

  beforeEach(() => {
    isolator = new IntelligentFaultIsolatorV2()
  })

  it('건강한 메트릭 → 장애 탐지 없음', () => {
    isolator.ingestHealth(healthyMetric)
    const faults = isolator.detect('SVC-1')
    expect(faults).toHaveLength(0)
  })

  it('헬스 데이터 없을 때 → 빈 배열', () => {
    const faults = isolator.detect('SVC-UNKNOWN')
    expect(faults).toHaveLength(0)
  })

  it('높은 지연(>2000ms) → LATENCY 장애 탐지', () => {
    isolator.ingestHealth({ ...healthyMetric, latencyP99Ms: 3000 })
    const faults = isolator.detect('SVC-1')
    expect(faults.some((f) => f.faultType === 'LATENCY')).toBe(true)
  })

  it('높은 오류율(>5%) → ERROR_RATE 장애 탐지', () => {
    isolator.ingestHealth({ ...healthyMetric, errorRatePct: 10 })
    const faults = isolator.detect('SVC-1')
    expect(faults.some((f) => f.faultType === 'ERROR_RATE')).toBe(true)
  })

  it('메모리 90% 초과 → MEMORY_LEAK 장애 탐지', () => {
    isolator.ingestHealth({ ...healthyMetric, memoryUsagePct: 95 })
    const faults = isolator.detect('SVC-1')
    expect(faults.some((f) => f.faultType === 'MEMORY_LEAK')).toBe(true)
  })

  it('CPU 85% 초과 → CPU_SPIKE 장애 탐지', () => {
    isolator.ingestHealth({ ...healthyMetric, cpuUsagePct: 90 })
    const faults = isolator.detect('SVC-1')
    expect(faults.some((f) => f.faultType === 'CPU_SPIKE')).toBe(true)
  })

  it('isolate: 알려진 장애 → success=true, recoveryEtaMs>0', () => {
    isolator.ingestHealth({ ...healthyMetric, latencyP99Ms: 3000 })
    const faults = isolator.detect('SVC-1')
    expect(faults.length).toBeGreaterThan(0)
    const result = isolator.isolate(faults[0]!.faultId)
    expect(result.success).toBe(true)
    expect(result.recoveryEtaMs).toBeGreaterThan(0)
  })

  it('isolate: 미등록 장애 ID → 오류 발생', () => {
    expect(() => isolator.isolate('UNKNOWN-FAULT')).toThrow('Unknown fault')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    isolator.ingestHealth({ ...healthyMetric, latencyP99Ms: 3000 })
    isolator.detect('SVC-1')
    const log1 = isolator.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = isolator.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
