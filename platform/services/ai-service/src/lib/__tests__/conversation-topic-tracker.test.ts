/**
 * Tests — SVC-AI-ADV-R131 Conversation Topic Tracker
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ConversationTopicTracker,
  DataGrade,
} from '../conversation-topic-tracker'

describe('ConversationTopicTracker — R131', () => {
  let tracker: ConversationTopicTracker

  beforeEach(() => {
    tracker = new ConversationTopicTracker(DataGrade.O, {
      topKKeywords: 10,
      similarityThreshold: 0.3,
      driftAlertThreshold: 1.5,
    })
  })

  it('FR-R131.1: startSession 초기 키워드 추출', () => {
    tracker.startSession('s1', '행정안전부 민원 접수 안내')
    const log = tracker.getAuditLog()
    expect(log.some((e) => e.action === 'sessionStarted')).toBe(true)
  })

  it('FR-R131.2: 동일 주제 → 유사도 높음', () => {
    tracker.startSession('s1', '행정안전부 민원 접수 절차 안내')
    const a = tracker.addMessage('s1', '민원 접수 방법 알려주세요')
    expect(a.similarity).toBeGreaterThan(0)
  })

  it('다른 주제 → drift 누적', () => {
    tracker.startSession('s1', '행정안전부 민원 접수 방법')
    const a = tracker.addMessage('s1', '오늘 날씨가 어때요')
    expect(a.drifted).toBe(true)
    expect(tracker.getDriftScore('s1')).toBeGreaterThan(0)
  })

  it('FR-R131.3: extractKeywords 한국어 2-gram', () => {
    const kw = tracker.extractKeywords('행정안전부')
    expect(kw.has('행정')).toBe(true)
    expect(kw.has('정안')).toBe(true)
    expect(kw.has('안전')).toBe(true)
    expect(kw.has('전부')).toBe(true)
  })

  it('extractKeywords 영어 단어', () => {
    const kw = tracker.extractKeywords('hello world service api')
    expect(kw.has('hello')).toBe(true)
    expect(kw.has('service')).toBe(true)
    expect(kw.has('api')).toBe(true)
  })

  it('FR-R131.4: computeSimilarity 경계값', () => {
    const a = new Set(['x', 'y', 'z'])
    const b = new Set(['x', 'y', 'z'])
    expect(tracker.computeSimilarity(a, b)).toBe(1)
    expect(tracker.computeSimilarity(new Set(['x']), new Set(['y']))).toBe(0)
    expect(tracker.computeSimilarity(new Set(), new Set())).toBe(0)
  })

  it('FR-R131.5: getDriftScore 누적', () => {
    tracker.startSession('s1', '민원 접수 서비스')
    tracker.addMessage('s1', '완전히 다른 주제 영화 이야기')
    tracker.addMessage('s1', '또 다른 주제 음식 이야기')
    const score = tracker.getDriftScore('s1')
    expect(score).toBeGreaterThan(0)
  })

  it('FR-R131.6: onTopicDrift emit', () => {
    let called = 0
    tracker.onTopicDrift(() => called++)
    tracker.startSession('s1', '민원 접수 안내')
    for (let i = 0; i < 5; i++) {
      tracker.addMessage('s1', `완전 다른 주제 xyz abc ${i}`)
    }
    expect(called).toBeGreaterThanOrEqual(1)
  })

  it('알람 중복 방지 (alerted 플래그)', () => {
    let called = 0
    tracker.onTopicDrift(() => called++)
    tracker.startSession('s1', '민원 접수')
    for (let i = 0; i < 10; i++) {
      tracker.addMessage('s1', `완전 다른 주제 xyz abc ${i}`)
    }
    expect(called).toBe(1)
  })

  it('PII 마스킹: 이메일', () => {
    tracker.startSession('s1', 'email test@example.com 문의')
    const a = tracker.addMessage('s1', 'contact user@domain.com please')
    expect(a.maskedText).toContain('***@***')
    expect(a.maskedText).not.toContain('user@domain.com')
  })

  it('PII 마스킹: 주민번호/전화번호', () => {
    tracker.startSession('s1', '민원')
    const a = tracker.addMessage('s1', '주민번호 901010-1234567 전화 010-1234-5678')
    expect(a.maskedText).toContain('******-*******')
    expect(a.maskedText).toContain('010-****-****')
  })

  it('N2SF N-05: C 등급 차단', () => {
    expect(() => new ConversationTopicTracker(DataGrade.C)).toThrow('N2SF N-05')
    expect(() => new ConversationTopicTracker(DataGrade.S)).toThrow('N2SF N-05')
  })

  it('미등록 세션 throw', () => {
    expect(() => tracker.addMessage('none', 'hello')).toThrow('unknown session')
    expect(() => tracker.getDriftScore('none')).toThrow('unknown session')
  })

  it('maxMessages 초과 throw', () => {
    const t2 = new ConversationTopicTracker(DataGrade.O, {
      maxMessagesPerSession: 2,
    })
    t2.startSession('s', '안내')
    t2.addMessage('s', 'msg1')
    t2.addMessage('s', 'msg2')
    expect(() => t2.addMessage('s', 'msg3')).toThrow('max messages')
  })

  it('중복 세션 throw', () => {
    tracker.startSession('s1', 'hello')
    expect(() => tracker.startSession('s1', 'world')).toThrow('already exists')
  })

  it('FR-R131.7: getAuditLog append-only', () => {
    tracker.startSession('s1', '민원')
    const l1 = tracker.getAuditLog()
    l1.push({
      action: 'sessionStarted',
      sessionId: '',
      timestamp: 0,
      details: {},
    })
    const l2 = tracker.getAuditLog()
    expect(l2.length).toBeLessThan(l1.length)
  })
})
