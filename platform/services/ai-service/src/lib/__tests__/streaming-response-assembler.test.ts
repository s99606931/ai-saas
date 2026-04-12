/**
 * Unit tests for Streaming Response Assembler — SVC-AI-ADV-R116
 */

import { describe, it, expect, vi } from 'vitest'
import {
  StreamingResponseAssembler,
  DataGrade,
} from '../streaming-response-assembler'

describe('SVC-AI-ADV-R116 StreamingResponseAssembler', () => {
  it('[FR-R116.7] C/S 등급 생성자 차단', () => {
    expect(
      () => new StreamingResponseAssembler({ grade: DataGrade.C }),
    ).toThrow(/BLOCKED/)
    expect(
      () => new StreamingResponseAssembler({ grade: DataGrade.S }),
    ).toThrow(/BLOCKED/)
  })

  it('[FR-R116.1] 토큰 누적 feed', () => {
    const a = new StreamingResponseAssembler()
    a.feed('{"name":')
    a.feed('"test"}')
    expect(a.getBuffer()).toBe('{"name":"test"}')
    expect(a.getState().tokensReceived).toBe(2)
  })

  it('[FR-R116.2] 부분 JSON 파싱 성공', () => {
    const onPartial = vi.fn()
    const a = new StreamingResponseAssembler({ onPartial })
    a.feed('{"a":1')
    // 복구 파서가 닫아줘서 partial 발행
    expect(onPartial).toHaveBeenCalled()
  })

  it('[FR-R116.4] 최종 검증 성공', () => {
    const onComplete = vi.fn()
    const a = new StreamingResponseAssembler({ onComplete })
    a.feed('{"x":42}')
    const ok = a.complete()
    expect(ok).toBe(true)
    expect(onComplete).toHaveBeenCalledWith({ x: 42 })
  })

  it('[FR-R116.4] validator 실패 시 onError', () => {
    const onError = vi.fn()
    const a = new StreamingResponseAssembler({ onError })
    a.feed('{"x":1}')
    const ok = a.complete((v) => {
      const obj = v as { x: number }
      return obj.x > 10
    })
    expect(ok).toBe(false)
    expect(onError).toHaveBeenCalled()
  })

  it('[FR-R116.5] 잘못된 JSON은 complete 실패', () => {
    const a = new StreamingResponseAssembler()
    a.feed('not-json-at-all')
    expect(a.complete()).toBe(false)
    expect(a.getState().failed).toBe(true)
  })

  it('[FR-R116.6] 이메일 PII 실시간 마스킹', () => {
    const a = new StreamingResponseAssembler()
    a.feed('{"email":"user@example.com"}')
    expect(a.getBuffer()).toContain('[EMAIL]')
    expect(a.getBuffer()).not.toContain('user@example.com')
    expect(a.getState().masked).toBeGreaterThan(0)
  })

  it('[FR-R116.6] 주민번호 마스킹', () => {
    const a = new StreamingResponseAssembler()
    a.feed('{"rrn":"900101-1234567"}')
    expect(a.getBuffer()).toContain('[RRN]')
  })

  it('[FR-R116.6] 전화번호 마스킹', () => {
    const a = new StreamingResponseAssembler()
    a.feed('{"phone":"010-1234-5678"}')
    expect(a.getBuffer()).toContain('[PHONE]')
  })

  it('[FR-R116.6] maskPII=false 옵션 존중', () => {
    const a = new StreamingResponseAssembler({ maskPII: false })
    a.feed('{"email":"x@y.com"}')
    expect(a.getBuffer()).toContain('x@y.com')
  })

  it('[FR-R116.8] 감사 로그 기록', () => {
    const a = new StreamingResponseAssembler()
    a.feed('{"a":1}')
    a.complete()
    const log = a.getAuditLog()
    expect(log.some((e) => e.action === 'feed')).toBe(true)
    expect(log.some((e) => e.action === 'complete')).toBe(true)
  })
})
