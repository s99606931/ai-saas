import { describe, it, expect, beforeEach } from 'vitest'
import { MultilingualNLPPipeline, type IntentDefinition } from '../multilingual-nlp-pipeline'

describe('MultilingualNLPPipeline', () => {
  let pipeline: MultilingualNLPPipeline

  const complaintKo: IntentDefinition = {
    intent: 'COMPLAINT',
    language: 'ko',
    keywords: ['불편', '문제', '민원'],
  }
  const inquiryEn: IntentDefinition = {
    intent: 'INQUIRY',
    language: 'en',
    keywords: ['how', 'where', 'information'],
  }

  beforeEach(() => {
    pipeline = new MultilingualNLPPipeline()
    pipeline.registerIntent(complaintKo)
    pipeline.registerIntent(inquiryEn)
  })

  it('C등급 민원 차단', () => {
    expect(() =>
      pipeline.process({
        requestId: 'R1',
        citizenId: 'CIT-001',
        text: '안녕하세요',
        grade: 'C',
      })
    ).toThrow('BLOCKED')
  })

  it('O등급 아닌 경우 거부', () => {
    expect(() =>
      pipeline.process({
        requestId: 'R2',
        citizenId: 'CIT-002',
        text: 'hello',
        grade: undefined,
      })
    ).toThrow('O등급만')
  })

  it('한국어 감지', () => {
    const result = pipeline.detectLanguage('안녕하세요 민원을 제기합니다')
    expect(result.language).toBe('ko')
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('영어 감지', () => {
    const result = pipeline.detectLanguage('hello how can I get information')
    expect(result.language).toBe('en')
  })

  it('중국어 감지', () => {
    const result = pipeline.detectLanguage('你好请问公共服务')
    expect(result.language).toBe('zh')
  })

  it('텍스트 정규화 — 특수문자 제거', () => {
    const result = pipeline.normalize('Hello, World!! How are you??')
    expect(result).not.toContain('!')
    expect(result).not.toContain(',')
    expect(result).toBe('hello world how are you')
  })

  it('키워드 추출 — 빈도 순', () => {
    const keywords = pipeline.extractKeywords('complaint complaint service public information information', 3)
    expect(keywords).toContain('complaint')
    expect(keywords).toContain('information')
    expect(keywords[0]).toMatch(/complaint|information/)
  })

  it('의도 분류 — 한국어 민원', () => {
    const result = pipeline.classifyIntent('이 서비스 불편하고 문제가 많아서 민원 넣습니다')
    expect(result).not.toBeNull()
    expect(result?.intent).toBe('COMPLAINT')
    expect((result?.matchedKeywords.length ?? 0)).toBeGreaterThanOrEqual(2)
  })

  it('의도 분류 — 영어 문의', () => {
    const result = pipeline.classifyIntent('how can I find information where is the office')
    expect(result?.intent).toBe('INQUIRY')
  })

  it('전체 파이프라인 — process', () => {
    const result = pipeline.process({
      requestId: 'REQ-001',
      citizenId: 'CIT-A1B2C3',
      text: '공공서비스 불편 민원 제기합니다',
      grade: 'O',
    })
    expect(result.language.language).toBe('ko')
    expect(result.intent?.intent).toBe('COMPLAINT')
    expect(result.keywords.length).toBeGreaterThan(0)
  })

  it('텍스트 길이 초과 차단', () => {
    const longText = 'a'.repeat(10_001)
    expect(() =>
      pipeline.process({ requestId: 'R', citizenId: 'C', text: longText, grade: 'O' })
    ).toThrow('10000')
  })

  it('감사 로그 — citizenId 마스킹', () => {
    pipeline.process({
      requestId: 'REQ-LOG',
      citizenId: 'CIT-A1B2C3',
      text: 'hello information',
      grade: 'O',
    })
    const log = pipeline.getAuditLog()
    const hasMasked = log.some((e) => e.citizenIdMasked.includes('***'))
    expect(hasMasked).toBe(true)
    const hasRaw = log.some((e) => e.citizenIdMasked === 'CIT-A1B2C3')
    expect(hasRaw).toBe(false)
  })
})
