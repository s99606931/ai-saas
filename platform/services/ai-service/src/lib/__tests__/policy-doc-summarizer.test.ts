import { describe, it, expect, beforeEach } from 'vitest'
import { PolicyDocSummarizer } from '../policy-doc-summarizer'

describe('PolicyDocSummarizer', () => {
  let summarizer: PolicyDocSummarizer

  beforeEach(() => {
    summarizer = new PolicyDocSummarizer()
  })

  it('N2SF C등급 문서 등록 차단', () => {
    expect(() => summarizer.registerDoc({ docId: 'D1', title: '기밀', body: '내용', category: 'test', grade: 'C' })).toThrow('BLOCKED')
  })

  it('N2SF S등급 문서 등록 차단', () => {
    expect(() => summarizer.registerDoc({ docId: 'D2', title: '비밀', body: '내용', category: 'test', grade: 'S' })).toThrow('BLOCKED')
  })

  it('정상 문서 요약 생성', () => {
    summarizer.registerDoc({ docId: 'D3', title: '정책 지침', body: '보안 정책 수립이 필요합니다. 보안 검토를 진행합니다. 보안 결과를 보고합니다.', category: 'security', grade: 'O' })
    const summary = summarizer.summarize('D3')
    expect(summary.docId).toBe('D3')
    expect(summary.keywords.length).toBeGreaterThan(0)
    expect(summary.keySentences.length).toBeGreaterThan(0)
    expect(summary.summary).toContain('문장')
  })

  it('키워드 최대 5개 반환', () => {
    summarizer.registerDoc({ docId: 'D4', title: '테스트', body: '가나다라마 바사아자차 가나다라마 가나다 가나 가', category: 'test', grade: 'O' })
    const summary = summarizer.summarize('D4')
    expect(summary.keywords.length).toBeLessThanOrEqual(5)
  })

  it('topN 파라미터로 핵심 문장 수 제어', () => {
    summarizer.registerDoc({ docId: 'D5', title: '긴 문서', body: '문장1. 문장2. 문장3. 문장4. 문장5.', category: 'test', grade: 'O' })
    const summary = summarizer.summarize('D5', 2)
    expect(summary.keySentences.length).toBeLessThanOrEqual(2)
  })

  it('알 수 없는 문서 요약 시 오류', () => {
    expect(() => summarizer.summarize('UNKNOWN')).toThrow('Unknown document')
  })

  it('감사 로그 복사본 반환', () => {
    summarizer.registerDoc({ docId: 'D6', title: '공개문서', body: '내용입니다.', category: 'public', grade: 'O' })
    summarizer.summarize('D6')
    const log = summarizer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', docId: 'X', detail: {} })
    expect(summarizer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
