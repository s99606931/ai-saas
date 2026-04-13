import { describe, it, expect, beforeEach } from 'vitest'
import { ContainerResourceOptimizerAi, type ContainerSpec, type ResourceSnapshot } from '../container-resource-optimizer-ai'

describe('ContainerResourceOptimizerAi', () => {
  let optimizer: ContainerResourceOptimizerAi

  const spec: ContainerSpec = {
    containerId: 'CON001',
    name: '민원 API 컨테이너',
    namespace: 'production',
    cpuLimitMilliCores: 1000,
    memoryLimitMb: 1024,
    minCpuMilliCores: 100,
    minMemoryMb: 128,
  }

  const makeSnapshot = (cpu: number, mem: number, oom = 0): ResourceSnapshot => ({
    containerId: 'CON001',
    timestamp: Date.now(),
    cpuUsageMilliCores: cpu,
    memoryUsageMb: mem,
    oomKillCount: oom,
  })

  beforeEach(() => {
    optimizer = new ContainerResourceOptimizerAi()
    optimizer.registerContainer(spec)
  })

  it('컨테이너 등록 감사 로그', () => {
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'container.register')).toBe(true)
  })

  it('스냅샷 없으면 NO_CHANGE', () => {
    const result = optimizer.optimize('CON001')
    expect(result.cpuAction).toBe('NO_CHANGE')
    expect(result.memoryAction).toBe('NO_CHANGE')
  })

  it('CPU 사용률 85% 초과 → INCREASE_CPU', () => {
    for (let i = 0; i < 5; i++) optimizer.recordSnapshot(makeSnapshot(900, 500))
    // 900/1000 = 90% > 85%
    const result = optimizer.optimize('CON001')
    expect(result.cpuAction).toBe('INCREASE_CPU')
    expect(result.recommendedCpuMilliCores).toBeGreaterThan(1000)
  })

  it('CPU 사용률 20% 미만 → DECREASE_CPU', () => {
    for (let i = 0; i < 5; i++) optimizer.recordSnapshot(makeSnapshot(100, 300))
    // 100/1000 = 10% < 20%
    const result = optimizer.optimize('CON001')
    expect(result.cpuAction).toBe('DECREASE_CPU')
    expect(result.recommendedCpuMilliCores).toBeLessThan(1000)
  })

  it('OOM Kill 발생 → INCREASE_MEMORY', () => {
    for (let i = 0; i < 5; i++) optimizer.recordSnapshot(makeSnapshot(500, 800, 1))
    const result = optimizer.optimize('CON001')
    expect(result.memoryAction).toBe('INCREASE_MEMORY')
    expect(result.oomRisk).toBe(true)
  })

  it('메모리 사용률 20% 미만 → DECREASE_MEMORY', () => {
    for (let i = 0; i < 5; i++) optimizer.recordSnapshot(makeSnapshot(500, 150))
    // 150/1024 ≈ 14.6% < 20%
    const result = optimizer.optimize('CON001')
    expect(result.memoryAction).toBe('DECREASE_MEMORY')
  })

  it('미등록 컨테이너 에러', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow()
  })

  it('미등록 컨테이너 스냅샷 에러', () => {
    expect(() => optimizer.recordSnapshot({ ...makeSnapshot(500, 500), containerId: 'UNKNOWN' })).toThrow()
  })

  it('최적화 후 감사 로그', () => {
    optimizer.recordSnapshot(makeSnapshot(500, 500))
    optimizer.optimize('CON001')
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'container.optimize')).toBe(true)
  })
})
