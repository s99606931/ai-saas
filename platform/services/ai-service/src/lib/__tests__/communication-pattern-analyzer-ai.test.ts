// Plan SC: SVC-AI-ADV-R440
import { describe, it, expect, beforeEach } from 'vitest'
import { CommunicationPatternAnalyzerAI } from '../communication-pattern-analyzer-ai'

describe('CommunicationPatternAnalyzerAI', () => {
  let analyzer: CommunicationPatternAnalyzerAI

  beforeEach(() => {
    analyzer = new CommunicationPatternAnalyzerAI()
  })

  it('addEvent — 감사 로그에 event.add 기록', () => {
    analyzer.addEvent('e1', 'email', 'user001', 5000)
    expect(analyzer.getAuditLog()[0]!.action).toBe('event.add')
  })

  it('addEvent — maskedParticipantId는 16자 hex (PII 보호)', () => {
    const event = analyzer.addEvent('e1', 'email', 'user001', 5000)
    expect(event.maskedParticipantId).toHaveLength(16)
    expect(event.maskedParticipantId).not.toBe('user001')
  })

  it('getChannelStats — 채널별 평균 응답시간 계산', () => {
    analyzer.addEvent('e1', 'email', 'u1', 4000)
    analyzer.addEvent('e2', 'email', 'u2', 6000)
    const stats = analyzer.getChannelStats('email')
    expect(stats.avgDurationMs).toBe(5000)
    expect(stats.eventCount).toBe(2)
  })

  it('getChannelStats — 이벤트 없는 채널 avgDurationMs=0', () => {
    const stats = analyzer.getChannelStats('chat')
    expect(stats.avgDurationMs).toBe(0)
    expect(stats.eventCount).toBe(0)
  })

  it('getInefficientChannels — threshold 초과 채널 반환', () => {
    analyzer.addEvent('e1', 'email', 'u1', 8000)
    analyzer.addEvent('e2', 'chat', 'u2', 2000)
    const inefficient = analyzer.getInefficientChannels(5000)
    expect(inefficient.some((s) => s.channel === 'email')).toBe(true)
    expect(inefficient.some((s) => s.channel === 'chat')).toBe(false)
  })

  it('addEvent — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => analyzer.addEvent('e1', 'email', 'u1', 1000, 'C')).toThrow('BLOCKED')
  })

  it('addEvent — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => analyzer.addEvent('e1', 'email', 'u1', 1000, 'S')).toThrow('N2SF N-05')
  })

  it('getInefficientChannels — 빈 목록 반환 (이벤트 없음)', () => {
    expect(analyzer.getInefficientChannels(5000)).toHaveLength(0)
  })
})
