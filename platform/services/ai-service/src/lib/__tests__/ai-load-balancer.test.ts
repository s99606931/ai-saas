/**
 * Tests — SVC-AI-ADV-R119 AI Load Balancer
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  AILoadBalancer,
  DataGrade,
  NoBackendAvailableError,
} from '../ai-load-balancer'

describe('AILoadBalancer — R119', () => {
  let lb: AILoadBalancer

  beforeEach(() => {
    lb = new AILoadBalancer({ strategy: 'round-robin' })
    lb.register({
      id: 'local-lm',
      weight: 5,
      maxConcurrency: 10,
      costPerToken: 0,
      tags: ['local'],
    })
    lb.register({
      id: 'openai',
      weight: 2,
      maxConcurrency: 5,
      costPerToken: 0.002,
      tags: ['premium'],
    })
    lb.register({
      id: 'specialized',
      weight: 1,
      maxConcurrency: 3,
      costPerToken: 0.01,
      tags: ['vision'],
    })
  })

  it('FR-R119.1: 백엔드 등록 + 메트릭 초기화', () => {
    expect(lb.listBackends().length).toBe(3)
    expect(lb.getMetrics('local-lm')?.inFlight).toBe(0)
    expect(lb.getMetrics('local-lm')?.health).toBe('healthy')
  })

  it('FR-R119.2: round-robin 순환', () => {
    const seq: string[] = []
    for (let i = 0; i < 6; i++) {
      seq.push(lb.select(DataGrade.O).id)
    }
    const unique = new Set(seq)
    expect(unique.size).toBe(3)
  })

  it('FR-R119.2: cost-optimal은 무료 모델 선택', () => {
    lb.setStrategy('cost-optimal')
    const selected = lb.select(DataGrade.O)
    expect(selected.id).toBe('local-lm')
  })

  it('FR-R119.2: tag hint 필터링', () => {
    lb.setStrategy('cost-optimal')
    const selected = lb.select(DataGrade.O, { tag: 'vision' })
    expect(selected.id).toBe('specialized')
  })

  it('FR-R119.3: maxConcurrency 초과 시 제외', () => {
    lb.setStrategy('least-loaded')
    // specialized maxConcurrency=3을 초과하도록
    for (let i = 0; i < 3; i++) {
      lb.select(DataGrade.O, { tag: 'vision' })
    }
    expect(() => lb.select(DataGrade.O, { tag: 'vision' })).toThrow(
      NoBackendAvailableError,
    )
  })

  it('FR-R119.4: setHealth(down)은 선택에서 제외', () => {
    lb.setHealth('local-lm', 'down')
    lb.setStrategy('cost-optimal')
    const selected = lb.select(DataGrade.O)
    expect(selected.id).not.toBe('local-lm')
  })

  it('FR-R119.6: recordSuccess → p95 레이턴시 계산', () => {
    const b = lb.select(DataGrade.O)
    lb.recordSuccess(b.id, 100)
    lb.recordSuccess(b.id, 200)
    lb.recordSuccess(b.id, 150)
    const m = lb.getMetrics(b.id)
    expect(m?.successCount).toBe(3)
    expect(m?.p95LatencyMs).toBeGreaterThan(0)
    expect(m?.inFlight).toBe(0)
  })

  it('FR-R119.6: 실패율 과반 → degraded 자동 전환', () => {
    const b = lb.select(DataGrade.O)
    for (let i = 0; i < 5; i++) {
      lb.recordFailure(b.id)
    }
    expect(lb.getMetrics(b.id)?.health).toBe('degraded')
  })

  it('FR-R119.2: latency-optimal은 최저 p95 선택', () => {
    // 모든 백엔드에 서로 다른 레이턴시 기록
    lb.recordSuccess(
      lb.listBackends().find((b) => b.id === 'local-lm')!.id,
      500,
    )
    // select + record 대신 직접 메트릭 조작: 최저 레이턴시를 openai로
    for (let i = 0; i < 5; i++) {
      const b = lb.select(DataGrade.O, { tag: 'premium' })
      lb.recordSuccess(b.id, 5)
    }
    for (let i = 0; i < 5; i++) {
      const b = lb.select(DataGrade.O, { tag: 'vision' })
      lb.recordSuccess(b.id, 900)
    }
    lb.setStrategy('latency-optimal')
    const picked = lb.select(DataGrade.O)
    expect(picked.id).toBe('openai')
  })

  it('FR-R119.7: C등급 차단', () => {
    expect(() => lb.select(DataGrade.C)).toThrow('BLOCKED')
  })

  it('FR-R119.7: S등급 차단', () => {
    expect(() => lb.select(DataGrade.S)).toThrow('N2SF N-05')
  })

  it('FR-R119.8: 감사 로그 기록', () => {
    const b = lb.select(DataGrade.O)
    lb.recordSuccess(b.id, 50)
    const log = lb.getAuditLog()
    expect(log.some((e) => e.action === 'register')).toBe(true)
    expect(log.some((e) => e.action === 'select')).toBe(true)
    expect(log.some((e) => e.action === 'recordSuccess')).toBe(true)
  })

  it('전 백엔드 down일 때 NoBackendAvailableError', () => {
    lb.setHealth('local-lm', 'down')
    lb.setHealth('openai', 'down')
    lb.setHealth('specialized', 'down')
    expect(() => lb.select(DataGrade.O)).toThrow(NoBackendAvailableError)
  })
})
