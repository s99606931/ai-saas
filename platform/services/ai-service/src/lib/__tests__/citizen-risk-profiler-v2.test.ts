import { describe, it, expect, beforeEach } from 'vitest'
import { CitizenRiskProfilerV2 } from '../citizen-risk-profiler-v2'

describe('CitizenRiskProfilerV2', () => {
  let profiler: CitizenRiskProfilerV2

  beforeEach(() => {
    profiler = new CitizenRiskProfilerV2()
  })

  it('N2SF C등급 이벤트 차단', () => {
    expect(() => profiler.recordEvent('c1', 'complaint', '안녕', 'C')).toThrow('BLOCKED')
  })

  it('citizenId SHA-256 16자 해시', () => {
    const event = profiler.recordEvent('c2', 'complaint', '안녕', 'O')
    expect(event.citizenIdHash).toMatch(/^[a-f0-9]{16}$/)
  })

  it('위협 키워드 다수 → HIGH 등급', () => {
    profiler.recordEvent('c3', 'complaint', '협박 협박 폭력', 'O')
    profiler.recordEvent('c3', 'call', '고소', 'O')
    const profile = profiler.getProfile('c3')
    expect(profile.level).toBe('HIGH')
  })

  it('일반 민원 → LOW 등급', () => {
    profiler.recordEvent('c4', 'complaint', '신청 방법 문의', 'O')
    expect(profiler.getProfile('c4').level).toBe('LOW')
  })

  it('우선 응대 큐: HIGH가 LOW보다 앞', () => {
    profiler.recordEvent('high', 'complaint', '협박 협박 폭력 자해', 'O')
    profiler.recordEvent('low', 'complaint', '문의', 'O')
    const queue = profiler.getPriorityQueue()
    expect(queue[0]!.level).toBe('HIGH')
  })

  it('감사 로그 복사본 반환', () => {
    profiler.recordEvent('c5', 'complaint', '안녕', 'O')
    const log = profiler.getAuditLog()
    log.push({ timestamp: '', action: 'injected', citizenIdHash: 'X', detail: {} })
    expect(profiler.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
