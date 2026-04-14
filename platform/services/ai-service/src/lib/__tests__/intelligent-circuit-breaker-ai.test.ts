// Plan SC: SVC-AI-ADV-R521-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentCircuitBreakerAI, type CircuitConfig, type CallRecord } from '../intelligent-circuit-breaker-ai'

describe('IntelligentCircuitBreakerAI', () => {
  let breaker: IntelligentCircuitBreakerAI

  const config: CircuitConfig = {
    serviceId: 'SVC-1',
    failureThresholdPct: 50,
    slowCallThresholdMs: 1000,
    slowCallRatePct: 50,
    windowSize: 10,
    openDurationMs: 5000,
    halfOpenMaxCalls: 3,
  }

  const makeCall = (id: string, success: boolean, ts = Date.now(), durationMs = 100): CallRecord => ({
    callId: id, serviceId: 'SVC-1', timestamp: ts, durationMs, success,
  })

  beforeEach(() => {
    breaker = new IntelligentCircuitBreakerAI()
  })

  it('미등록 서비스 상태 조회 시 오류 발생', () => {
    expect(() => breaker.getStatus('UNKNOWN')).toThrow('Unknown service')
  })

  it('초기 상태 → CLOSED', () => {
    breaker.registerConfig(config)
    const status = breaker.getStatus('SVC-1')
    expect(status.state).toBe('CLOSED')
  })

  it('실패율 50% 이상 → OPEN으로 전환', () => {
    breaker.registerConfig(config)
    const base = Date.now()
    for (let i = 0; i < 10; i++) {
      breaker.recordCall(makeCall(`C${i}`, i >= 5, base + i))
    }
    const status = breaker.getStatus('SVC-1')
    expect(status.state).toBe('OPEN')
  })

  it('느린 호출 비율 50% 이상 → OPEN으로 전환', () => {
    breaker.registerConfig(config)
    const base = Date.now()
    for (let i = 0; i < 10; i++) {
      breaker.recordCall({ ...makeCall(`SC${i}`, true, base + i), durationMs: i >= 5 ? 1500 : 100 })
    }
    const status = breaker.getStatus('SVC-1')
    expect(status.state).toBe('OPEN')
  })

  it('OPEN 상태에서 openDuration 경과 → HALF_OPEN', () => {
    breaker.registerConfig(config)
    const base = Date.now()
    for (let i = 0; i < 10; i++) {
      breaker.recordCall(makeCall(`C${i}`, false, base + i))
    }
    // openDurationMs 경과 후 호출
    breaker.recordCall(makeCall('PROBE', true, base + 6000))
    const status = breaker.getStatus('SVC-1')
    expect(status.state).toBe('HALF_OPEN')
  })

  it('정상 호출만 → CLOSED 유지', () => {
    breaker.registerConfig(config)
    const base = Date.now()
    for (let i = 0; i < 10; i++) {
      breaker.recordCall(makeCall(`C${i}`, true, base + i))
    }
    expect(breaker.getStatus('SVC-1').state).toBe('CLOSED')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    breaker.registerConfig(config)
    breaker.recordCall(makeCall('C1', true))
    const log1 = breaker.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = breaker.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
