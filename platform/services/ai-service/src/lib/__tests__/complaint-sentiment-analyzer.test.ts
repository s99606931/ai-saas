import { describe, it, expect, beforeEach } from 'vitest'
import { ComplaintSentimentAnalyzer } from '../complaint-sentiment-analyzer'

describe('ComplaintSentimentAnalyzer', () => {
  let analyzer: ComplaintSentimentAnalyzer

  beforeEach(() => {
    analyzer = new ComplaintSentimentAnalyzer()
  })

  it('N2SF C등급 분석 차단', () => {
    expect(() => analyzer.analyzeComplaint('C1', '내용', '부서A', 'C')).toThrow('BLOCKED')
  })

  it('N2SF S등급 분석 차단', () => {
    expect(() => analyzer.analyzeComplaint('C2', '내용', '부서A', 'S')).toThrow('BLOCKED')
  })

  it('긴급 키워드 포함 시 URGENT 분류', () => {
    const result = analyzer.analyzeComplaint('C3', '긴급 상황이 발생했습니다 위험합니다', '부서A')
    expect(result.sentiment).toBe('URGENT')
  })

  it('부정 키워드 우세 시 NEGATIVE 분류', () => {
    const result = analyzer.analyzeComplaint('C4', '불만 문제 오류 항의', '부서A')
    expect(result.sentiment).toBe('NEGATIVE')
  })

  it('긍정 키워드 시 POSITIVE 분류', () => {
    const result = analyzer.analyzeComplaint('C5', '감사 만족 친절 칭찬', '부서A')
    expect(result.sentiment).toBe('POSITIVE')
  })

  it('PII 마스킹 적용 확인', () => {
    const result = analyzer.analyzeComplaint('C6', '010-1234-5678로 연락주세요', '부서B')
    expect(result.maskedText).not.toContain('010-1234-5678')
  })

  it('부서별 집계 리포트', () => {
    analyzer.analyzeComplaint('C7', '불만 문제', '부서A')
    analyzer.analyzeComplaint('C8', '감사 만족', '부서A')
    const report = analyzer.getDepartmentReport('부서A')
    expect(report.totalComplaints).toBe(2)
    expect(report.sentimentBreakdown['NEGATIVE']).toBe(1)
    expect(report.sentimentBreakdown['POSITIVE']).toBe(1)
  })

  it('감사 로그 복사본 반환', () => {
    analyzer.analyzeComplaint('C9', '내용', '부서A')
    const log = analyzer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', complaintId: 'X', detail: {} })
    expect(analyzer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
