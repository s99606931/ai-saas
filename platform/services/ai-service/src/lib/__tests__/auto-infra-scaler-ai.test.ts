import { describe, it, expect, beforeEach } from 'vitest'
import { AutoInfraScalerAi, type InfraService, type InfraMetric } from '../auto-infra-scaler-ai'

describe('AutoInfraScalerAi', () => {
  let scaler: AutoInfraScalerAi

  const service: InfraService = {
    serviceId: 'SVC001',
    serviceName: '민원 API',
    minReplicas: 2,
    maxReplicas: 10,
    currentReplicas: 4,
    targetCpuPercent: 60,
  }

  const normalMetric: InfraMetric = {
    serviceId: 'SVC001',
    timestamp: Date.now(),
    cpuPercent: 55,
    memoryPercent: 50,
    requestQueueDepth: 0,
  }

  beforeEach(() => {
    scaler = new AutoInfraScalerAi()
    scaler.registerService(service)
  })

  it('서비스 등록 감사 로그', () => {
    const log = scaler.getAuditLog()
    expect(log.some((e) => e.action === 'service.register')).toBe(true)
  })

  it('정상 CPU → NO_CHANGE', () => {
    const decision = scaler.decide(normalMetric)
    expect(decision.action).toBe('NO_CHANGE')
  })

  it('CPU 120% 초과 → SCALE_UP', () => {
    // 목표 60% * 1.2 = 72% 초과
    const decision = scaler.decide({ ...normalMetric, cpuPercent: 80 })
    expect(decision.action).toBe('SCALE_UP')
    expect(decision.recommendedReplicas).toBeGreaterThan(service.currentReplicas)
  })

  it('큐 100 초과 → SCALE_UP IMMEDIATE', () => {
    const decision = scaler.decide({ ...normalMetric, requestQueueDepth: 150 })
    expect(decision.action).toBe('SCALE_UP')
    expect(decision.urgency).toBe('IMMEDIATE')
  })

  it('CPU 50% 미만 + 큐 0 → SCALE_DOWN', () => {
    // 목표 60% * 0.5 = 30% 미만
    const decision = scaler.decide({ ...normalMetric, cpuPercent: 20 })
    expect(decision.action).toBe('SCALE_DOWN')
    expect(decision.recommendedReplicas).toBeLessThan(service.currentReplicas)
  })

  it('최대 레플리카 초과 불가', () => {
    const decision = scaler.decide({ ...normalMetric, cpuPercent: 95, requestQueueDepth: 500 })
    expect(decision.recommendedReplicas).toBeLessThanOrEqual(service.maxReplicas)
  })

  it('미등록 서비스 에러', () => {
    expect(() => scaler.decide({ ...normalMetric, serviceId: 'UNKNOWN' })).toThrow()
  })

  it('스케일링 결정 후 감사 로그', () => {
    scaler.decide(normalMetric)
    const log = scaler.getAuditLog()
    expect(log.some((e) => e.action === 'infra.scale')).toBe(true)
  })
})
