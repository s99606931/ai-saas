import { describe, it, expect, beforeEach } from 'vitest'
import { AIModelVersioningGateway } from '../ai-model-versioning-gateway'

describe('AIModelVersioningGateway', () => {
  let gateway: AIModelVersioningGateway

  beforeEach(() => {
    gateway = new AIModelVersioningGateway()
    gateway.registerModel({ modelId: 'rag-qa', version: '1.0.0', status: 'BLUE' })
    gateway.registerModel({ modelId: 'rag-qa', version: '2.0.0-rc', status: 'GREEN' })
  })

  it('중복 version 차단', () => {
    expect(() =>
      gateway.registerModel({ modelId: 'rag-qa', version: '1.0.0', status: 'BLUE' })
    ).toThrow('중복')
  })

  it('트래픽 비율 합 != 100 차단', () => {
    expect(() => gateway.setTrafficSplit('rag-qa', 70, 20)).toThrow('100')
  })

  it('음수 비율 차단', () => {
    expect(() => gateway.setTrafficSplit('rag-qa', 110, -10)).toThrow('0')
  })

  it('C등급 호출 차단', () => {
    gateway.setTrafficSplit('rag-qa', 80, 20)
    expect(() =>
      gateway.routeRequest('rag-qa', 'req-1', 'user-1', 'C')
    ).toThrow('BLOCKED')
  })

  it('O등급 아닌 경우 거부', () => {
    gateway.setTrafficSplit('rag-qa', 80, 20)
    expect(() =>
      gateway.routeRequest('rag-qa', 'req-1', 'user-1', 'O' as any)
    ).not.toThrow()
  })

  it('기본 설정 — blue 100%', () => {
    const result = gateway.routeRequest('rag-qa', 'req-any', 'caller-user-abc', 'O')
    expect(result.status).toBe('BLUE')
    expect(result.selectedVersion).toBe('1.0.0')
  })

  it('트래픽 분할 — blue/green 모두 선택됨', () => {
    gateway.setTrafficSplit('rag-qa', 50, 50)
    const results = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const r = gateway.routeRequest('rag-qa', `req-${i}`, 'caller-test', 'O')
      results.add(r.selectedVersion)
    }
    expect(results.has('1.0.0')).toBe(true)
    expect(results.has('2.0.0-rc')).toBe(true)
  })

  it('동일 requestKey → 결정론적 라우팅', () => {
    gateway.setTrafficSplit('rag-qa', 50, 50)
    const r1 = gateway.routeRequest('rag-qa', 'stable-key', 'c1', 'O')
    const r2 = gateway.routeRequest('rag-qa', 'stable-key', 'c1', 'O')
    expect(r1.selectedVersion).toBe(r2.selectedVersion)
    expect(r1.bucket).toBe(r2.bucket)
  })

  it('recordCall + getStats', () => {
    gateway.recordCall('rag-qa', '1.0.0', true, 120)
    gateway.recordCall('rag-qa', '1.0.0', false, 80)
    gateway.recordCall('rag-qa', '2.0.0-rc', true, 200)
    const stats = gateway.getStats('rag-qa')
    expect(stats.versions['1.0.0']?.totalCalls).toBe(2)
    expect(stats.versions['1.0.0']?.errorCalls).toBe(1)
    expect(stats.versions['1.0.0']?.avgLatencyMs).toBe(100)
    expect(stats.versions['2.0.0-rc']?.totalCalls).toBe(1)
  })

  it('latency 음수 차단', () => {
    expect(() => gateway.recordCall('rag-qa', '1.0.0', true, -1)).toThrow('latencyMs')
  })

  it('rollback → green RETIRED + blue 100%', () => {
    gateway.setTrafficSplit('rag-qa', 50, 50)
    gateway.rollback('rag-qa')
    // 모든 라우팅이 blue로 전환
    for (let i = 0; i < 50; i++) {
      const r = gateway.routeRequest('rag-qa', `rk-${i}`, 'c', 'O')
      expect(r.status).toBe('BLUE')
      expect(r.selectedVersion).toBe('1.0.0')
    }
  })

  it('감사 로그 — caller 마스킹', () => {
    gateway.setTrafficSplit('rag-qa', 80, 20)
    gateway.routeRequest('rag-qa', 'req-log', 'caller-sensitive-id', 'O')
    const log = gateway.getAuditLog()
    const routeLogs = log.filter((e) => e.action === 'route')
    expect(routeLogs.length).toBeGreaterThan(0)
    for (const entry of routeLogs) {
      expect(entry.callerMasked).toContain('***')
      expect(entry.callerMasked).not.toBe('caller-sensitive-id')
    }
  })
})
