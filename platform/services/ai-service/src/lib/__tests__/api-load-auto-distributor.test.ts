import { describe, it, expect, beforeEach } from 'vitest'
import { ApiLoadAutoDistributor } from '../api-load-auto-distributor'

describe('ApiLoadAutoDistributor', () => {
  let ai: ApiLoadAutoDistributor

  beforeEach(() => {
    ai = new ApiLoadAutoDistributor()
    ai.registerEndpoint('ep1', 'https://api1.example.com', 3, 'active')
    ai.registerEndpoint('ep2', 'https://api2.example.com', 1, 'active')
  })

  it('엔드포인트 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'endpoint.register')).toBe(true)
  })

  it('라우팅 결정 반환', () => {
    const decision = ai.route()
    expect(['ep1', 'ep2']).toContain(decision.endpointId)
  })

  it('비활성 엔드포인트 제외', () => {
    ai.registerEndpoint('ep3', 'https://api3.example.com', 10, 'inactive')
    for (let i = 0; i < 20; i++) {
      const d = ai.route()
      expect(d.endpointId).not.toBe('ep3')
    }
  })

  it('가중치 반영 — ep1(weight=3)이 ep2(weight=1)보다 더 많이 선택', () => {
    const counts: Record<string, number> = { ep1: 0, ep2: 0 }
    for (let i = 0; i < 1000; i++) {
      const d = ai.route()
      counts[d.endpointId] = (counts[d.endpointId] ?? 0) + 1
    }
    expect(counts['ep1']!).toBeGreaterThan(counts['ep2']!)
  })

  it('지연 시간 기록 및 평균 계산', () => {
    ai.recordLatency('ep1', 100)
    ai.recordLatency('ep1', 200)
    const stats = ai.getLoadStats()
    const ep1Stats = stats.find((s) => s.endpointId === 'ep1')!
    expect(ep1Stats.avgLatencyMs).toBe(150)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.route('C')).toThrow('BLOCKED')
  })

  it('활성 엔드포인트 없을 때 에러', () => {
    ai.registerEndpoint('ep4', 'https://api4.example.com', 1, 'inactive')
    const ai2 = new ApiLoadAutoDistributor()
    ai2.registerEndpoint('ep5', 'https://api5.example.com', 1, 'inactive')
    expect(() => ai2.route()).toThrow()
  })
})
