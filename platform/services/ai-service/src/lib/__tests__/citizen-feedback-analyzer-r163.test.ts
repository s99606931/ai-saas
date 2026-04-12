/**
 * Tests — SVC-AI-ADV-R163 Citizen Feedback Analyzer
 */

import { describe, it, expect } from 'vitest'
import { CitizenFeedbackAnalyzerR163 } from '../citizen-feedback-analyzer-r163'

function makeAnalyzer() {
  let t = 1_700_000_000_000
  return new CitizenFeedbackAnalyzerR163({
    now: () => {
      t += 1
      return t
    },
  })
}

describe('CitizenFeedbackAnalyzerR163', () => {
  it('부정 감성 + 긴급 키워드 → 긴급 큐 등록', () => {
    const a = makeAnalyzer()
    const r = a.analyze('화재 위험 긴급 불만')
    expect(r.sentiment).toBe('negative')
    expect(r.urgency).toBeGreaterThanOrEqual(70)
    expect(a.getUrgentQueue().length).toBe(1)
  })

  it('복지 키워드 → topic=welfare', () => {
    const a = makeAnalyzer()
    const r = a.analyze('복지 지원금 수급 안내 필요')
    expect(r.topic).toBe('welfare')
  })

  it('교통 키워드 → topic=traffic', () => {
    const a = makeAnalyzer()
    const r = a.analyze('신호등 고장 교통 불편')
    expect(r.topic).toBe('traffic')
  })

  it('긍정 피드백 → sentiment=positive', () => {
    const a = makeAnalyzer()
    const r = a.analyze('직원이 친절하고 만족합니다 감사')
    expect(r.sentiment).toBe('positive')
    expect(r.urgency).toBeLessThan(70)
  })

  it('중립 텍스트 → sentiment=neutral', () => {
    const a = makeAnalyzer()
    const r = a.analyze('확인 요청합니다')
    expect(r.sentiment).toBe('neutral')
  })

  it('빈 텍스트 → invalid_text', () => {
    const a = makeAnalyzer()
    expect(() => a.analyze('')).toThrow('invalid_text')
    expect(() => a.analyze('   ')).toThrow('invalid_text')
  })

  it('C/S 등급 차단', () => {
    const a = makeAnalyzer()
    expect(() => a.analyze('test', 'C')).toThrow('grade_blocked')
    expect(() => a.analyze('test', 'S')).toThrow('grade_blocked')
    expect(a.getStats().blocked).toBe(2)
  })

  it('getTrend 주제별 집계', () => {
    const a = makeAnalyzer()
    a.analyze('복지 수급')
    a.analyze('복지 연금')
    a.analyze('교통 신호')
    const trend = a.getTrend()
    const welfare = trend.find((t) => t.topic === 'welfare')
    expect(welfare?.count).toBe(2)
  })

  it('감사 로그에 analyzed/urgent_queued 기록', () => {
    const a = makeAnalyzer()
    a.analyze('화재 위험 긴급')
    const events = a.getAuditLog().map((l) => l.event)
    expect(events).toContain('analyzed')
    expect(events).toContain('urgent_queued')
  })

  it('통계는 totalAnalyzed/urgentCount 반환', () => {
    const a = makeAnalyzer()
    a.analyze('정상 문의')
    a.analyze('화재 위험 긴급 최악')
    const s = a.getStats()
    expect(s.totalAnalyzed).toBe(2)
    expect(s.urgentCount).toBeGreaterThanOrEqual(1)
  })

  it('긴급도는 0~100 범위', () => {
    const a = makeAnalyzer()
    const r = a.analyze('위험 긴급 사고 즉시 응급 피해 불만 최악')
    expect(r.urgency).toBeLessThanOrEqual(100)
    expect(r.urgency).toBeGreaterThanOrEqual(0)
  })
})
