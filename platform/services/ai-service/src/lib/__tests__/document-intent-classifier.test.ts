/**
 * Tests — SVC-AI-ADV-R145 Document Intent Classifier
 */

import { describe, it, expect } from 'vitest'
import { DocumentIntentClassifier } from '../document-intent-classifier'

function makeClassifier() {
  let t = 1_700_000_000_000
  return new DocumentIntentClassifier({
    now: () => {
      t += 1
      return t
    },
  })
}

function seed(c: DocumentIntentClassifier) {
  c.register({
    label: 'complaint',
    keywords: [
      { term: '불편', weight: 3 },
      { term: '민원', weight: 2 },
      { term: '항의', weight: 3 },
    ],
  })
  c.register({
    label: 'request',
    keywords: [
      { term: '신청', weight: 3 },
      { term: '요청', weight: 2 },
    ],
  })
  c.register({
    label: 'inquiry',
    keywords: [
      { term: '문의', weight: 3 },
      { term: '질문', weight: 2 },
    ],
  })
}

describe('DocumentIntentClassifier', () => {
  it('complaint 분류', () => {
    const c = makeClassifier()
    seed(c)
    const r = c.classify('도로 포장 불편 민원 접수합니다')
    expect(r.top.label).toBe('complaint')
    expect(r.top.score).toBe(5)
  })

  it('request 분류', () => {
    const c = makeClassifier()
    seed(c)
    const r = c.classify('증명서 발급 신청합니다')
    expect(r.top.label).toBe('request')
  })

  it('inquiry 분류', () => {
    const c = makeClassifier()
    seed(c)
    const r = c.classify('운영 시간 문의드립니다')
    expect(r.top.label).toBe('inquiry')
  })

  it('임계값 미달 unknown', () => {
    const c = makeClassifier()
    seed(c)
    const r = c.classify('안녕하세요 좋은 하루 되세요', 'O', { threshold: 5 })
    expect(r.top.label).toBe('unknown')
  })

  it('매칭 없는 경우 unknown', () => {
    const c = makeClassifier()
    seed(c)
    const r = c.classify('날씨가 참 좋네요')
    expect(r.top.label).toBe('unknown')
  })

  it('topK 적용', () => {
    const c = makeClassifier()
    seed(c)
    const r = c.classify('민원 신청 문의', 'O', { topK: 2 })
    expect(r.all.length).toBe(2)
  })

  it('중복 등록 오류', () => {
    const c = makeClassifier()
    c.register({
      label: 'x',
      keywords: [{ term: 'a', weight: 1 }],
    })
    expect(() =>
      c.register({
        label: 'x',
        keywords: [{ term: 'b', weight: 1 }],
      }),
    ).toThrow('duplicate_intent')
  })

  it('빈 텍스트 거부', () => {
    const c = makeClassifier()
    seed(c)
    expect(() => c.classify('')).toThrow('invalid_text')
    expect(() => c.classify('   ')).toThrow('invalid_text')
  })

  it('잘못된 키워드 거부', () => {
    const c = makeClassifier()
    expect(() =>
      c.register({
        label: 'bad',
        keywords: [{ term: '', weight: 1 }],
      }),
    ).toThrow('invalid_keyword')
    expect(() =>
      c.register({
        label: 'bad2',
        keywords: [{ term: 'ok', weight: 0 }],
      }),
    ).toThrow('invalid_keyword')
  })

  it('빈 인텐트 정의 거부', () => {
    const c = makeClassifier()
    expect(() =>
      c.register({
        label: 'empty',
        keywords: [],
      }),
    ).toThrow('invalid_intent')
    expect(() =>
      c.register({
        label: '',
        keywords: [{ term: 'a', weight: 1 }],
      }),
    ).toThrow('invalid_intent')
  })

  it('대소문자 무시', () => {
    const c = makeClassifier()
    c.register({
      label: 'en',
      keywords: [{ term: 'hello', weight: 2 }],
    })
    const r = c.classify('Hello World')
    expect(r.top.label).toBe('en')
  })

  it('C/S등급 차단', () => {
    const c = makeClassifier()
    seed(c)
    expect(() => c.classify('민원', 'C')).toThrow('grade_blocked')
    expect(() => c.classify('민원', 'S')).toThrow('grade_blocked')
  })

  it('동점 시 알파벳 순', () => {
    const c = makeClassifier()
    c.register({
      label: 'z-alpha',
      keywords: [{ term: 'tie', weight: 1 }],
    })
    c.register({
      label: 'a-alpha',
      keywords: [{ term: 'tie', weight: 1 }],
    })
    const r = c.classify('tie case')
    expect(r.top.label).toBe('a-alpha')
  })

  it('getAuditLog', () => {
    const c = makeClassifier()
    seed(c)
    c.classify('민원')
    const log = c.getAuditLog()
    expect(log.some((e) => e.event === 'intent_registered')).toBe(true)
    expect(log.some((e) => e.event === 'classified')).toBe(true)
  })
})
