/**
 * Tests — SVC-AI-ADV-R125 RAG Source Attribution
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  RAGSourceAttribution,
  DataGrade,
} from '../rag-source-attribution'

describe('RAGSourceAttribution — R125', () => {
  let rsa: RAGSourceAttribution

  beforeEach(() => {
    rsa = new RAGSourceAttribution({ minOverlap: 0.1 })
    rsa.registerChunk({
      id: 'chunk-1',
      source: 'docs/csap.md',
      content: 'CSAP 중등급 인증은 79개 통제항목을 점검합니다',
      grade: DataGrade.O,
    })
    rsa.registerChunk({
      id: 'chunk-2',
      source: 'docs/n2sf.md',
      content: 'N2SF 6개 보안 영역과 등급 분류 체계',
      grade: DataGrade.O,
    })
    rsa.registerChunk({
      id: 'chunk-3',
      source: 'docs/audit.md',
      content: 'Audit logs must be retained for at least one year',
      grade: DataGrade.O,
    })
  })

  it('FR-R125.1: 청크 등록', () => {
    const result = rsa.attribute('아무 내용')
    expect(result.sentences.length).toBe(1)
  })

  it('FR-R125.8: C등급 청크 차단', () => {
    expect(() =>
      rsa.registerChunk({
        id: 'x',
        source: 's',
        content: 'c',
        grade: DataGrade.C,
      }),
    ).toThrow('BLOCKED')
  })

  it('FR-R125.8: S등급 청크 차단', () => {
    expect(() =>
      rsa.registerChunk({
        id: 'x',
        source: 's',
        content: 'c',
        grade: DataGrade.S,
      }),
    ).toThrow('N2SF N-05')
  })

  it('FR-R125.2: 한국어 문장 분할', () => {
    const r = rsa.attribute('첫 문장입니다. 두 번째 문장? 세 번째!')
    expect(r.sentences.length).toBe(3)
  })

  it('FR-R125.2: 영어 문장 분할', () => {
    const r = rsa.attribute('First sentence. Second sentence? Third!')
    expect(r.sentences.length).toBe(3)
  })

  it('FR-R125.3: 토큰 overlap 매칭 — 한국어', () => {
    const r = rsa.attribute('CSAP 중등급은 79개 통제항목 점검입니다')
    const first = r.sentences[0]
    expect(first?.citations).toContain('chunk-1')
  })

  it('FR-R125.3: 토큰 overlap 매칭 — 영어', () => {
    const r = rsa.attribute('Audit logs retained for one year')
    const first = r.sentences[0]
    expect(first?.citations).toContain('chunk-3')
  })

  it('FR-R125.4: 인용 ID [1] [2] 부여', () => {
    const r = rsa.attribute('CSAP 79개 통제항목 점검입니다. N2SF 6개 보안 영역.')
    expect(r.citationMap.length).toBeGreaterThanOrEqual(1)
    expect(r.citationMap[0]?.citation).toBe('[1]')
  })

  it('FR-R125.5: 하이라이트 마크업 부착', () => {
    const r = rsa.attribute('CSAP 79개 통제항목')
    const first = r.sentences[0]
    expect(first?.marked).toMatch(/\[1\]/)
  })

  it('FR-R125.6: confidence 0~1', () => {
    const r = rsa.attribute('CSAP 중등급 79개 통제항목 점검 인증')
    const first = r.sentences[0]
    expect(first?.confidence).toBeGreaterThan(0)
    expect(first?.confidence).toBeLessThanOrEqual(1)
  })

  it('FR-R125.7: avgConfidence 낮으면 lowConfidence 플래그', () => {
    const r = rsa.attribute('완전히 무관한 내용 아무도 모름 우주의 끝')
    expect(r.lowConfidence).toBe(true)
  })

  it('관련 내용은 lowConfidence 아님', () => {
    const r = rsa.attribute('CSAP 79개 통제항목 N2SF 6개 보안 영역 등급')
    expect(r.lowConfidence).toBe(false)
  })

  it('동일 청크 재인용 시 같은 라벨', () => {
    const r = rsa.attribute(
      'CSAP 통제항목 79개. CSAP 중등급 79개 인증.',
    )
    const labels = r.citationMap.filter((c) => c.chunkId === 'chunk-1')
    expect(labels.length).toBe(1)
  })

  it('FR-R125.5: snippet PII 마스킹', () => {
    rsa.registerChunk({
      id: 'pii-chunk',
      source: 'pii.md',
      content: '문의 이메일은 test@example.com 입니다',
      grade: DataGrade.O,
    })
    const r = rsa.attribute('문의 이메일은 어떻게 됩니까')
    const piiCitation = r.citationMap.find((c) => c.chunkId === 'pii-chunk')
    if (piiCitation) {
      expect(piiCitation.snippet).not.toContain('test@example.com')
    }
  })

  it('빈 응답 처리', () => {
    const r = rsa.attribute('')
    expect(r.sentences.length).toBe(0)
    expect(r.avgConfidence).toBe(0)
  })

  it('FR-R125.9: 감사 로그', () => {
    rsa.attribute('CSAP 중등급')
    const log = rsa.getAuditLog()
    expect(log.some((e) => e.action === 'registerChunk')).toBe(true)
    expect(log.some((e) => e.action === 'attribute')).toBe(true)
  })

  it('lowConfidence 감사', () => {
    rsa.attribute('완전히 무관한 우주적 내용')
    const log = rsa.getAuditLog()
    expect(log.some((e) => e.action === 'lowConfidence')).toBe(true)
  })

  it('maxCitationsPerSentence 제한', () => {
    const limited = new RAGSourceAttribution({
      minOverlap: 0.05,
      maxCitationsPerSentence: 1,
    })
    limited.registerChunk({
      id: 'a',
      source: 'a',
      content: 'CSAP 79',
      grade: DataGrade.O,
    })
    limited.registerChunk({
      id: 'b',
      source: 'b',
      content: 'CSAP 인증',
      grade: DataGrade.O,
    })
    const r = limited.attribute('CSAP 79 인증')
    expect(r.sentences[0]?.citations.length).toBeLessThanOrEqual(1)
  })

  it('chunk 등록 시 id/content 검증', () => {
    expect(() =>
      rsa.registerChunk({
        id: '',
        source: 's',
        content: 'c',
        grade: DataGrade.O,
      }),
    ).toThrow()
  })
})
