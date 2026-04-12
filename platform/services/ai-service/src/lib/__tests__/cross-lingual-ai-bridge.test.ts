/**
 * Unit tests for Cross-Lingual AI Bridge — SVC-AI-ADV-R117
 */

import { describe, it, expect } from 'vitest'
import {
  CrossLingualAIBridge,
  DataGrade,
  type Lang,
} from '../cross-lingual-ai-bridge'

async function mockTranslator(
  text: string,
  _to: Lang,
): Promise<{ text: string; confidence: number }> {
  return { text: `[TR]${text}`, confidence: 0.8 }
}

describe('SVC-AI-ADV-R117 CrossLingualAIBridge', () => {
  it('[FR-R117.1] 한국어 감지', () => {
    const b = new CrossLingualAIBridge()
    expect(b.detectLang('안녕하세요 공공기관입니다')).toBe('ko')
  })

  it('[FR-R117.1] 영어 감지', () => {
    const b = new CrossLingualAIBridge()
    expect(b.detectLang('Hello public institution')).toBe('en')
  })

  it('[FR-R117.1] 일본어 감지 (히라가나)', () => {
    const b = new CrossLingualAIBridge()
    expect(b.detectLang('こんにちは')).toBe('ja')
  })

  it('[FR-R117.1] 중국어 감지 (한자만)', () => {
    const b = new CrossLingualAIBridge()
    expect(b.detectLang('公共机构信息')).toBe('zh')
  })

  it('[FR-R117.6] C 등급 차단', async () => {
    const b = new CrossLingualAIBridge({ translator: mockTranslator })
    await expect(
      b.translate({
        text: '비밀',
        targetLang: 'en',
        grade: DataGrade.C,
      }),
    ).rejects.toThrow(/BLOCKED/)
  })

  it('[FR-R117.6] S 등급 차단', async () => {
    const b = new CrossLingualAIBridge({ translator: mockTranslator })
    await expect(
      b.translate({
        text: 'top',
        targetLang: 'en',
        grade: DataGrade.S,
      }),
    ).rejects.toThrow(/BLOCKED/)
  })

  it('[FR-R117.2,5] 번역 결과 구조 + confidence', async () => {
    const b = new CrossLingualAIBridge({ translator: mockTranslator })
    const r = await b.translate({
      text: '안녕하세요',
      targetLang: 'en',
      grade: DataGrade.O,
    })
    expect(r.sourceLang).toBe('ko')
    expect(r.targetLang).toBe('en')
    expect(r.confidence).toBeGreaterThan(0)
    expect(r.confidence).toBeLessThanOrEqual(1)
  })

  it('[FR-R117.3] 용어 사전 후처리 — 행정안전부', async () => {
    const b = new CrossLingualAIBridge({ translator: mockTranslator })
    const r = await b.translate({
      text: '행정안전부 공지',
      targetLang: 'en',
      grade: DataGrade.O,
    })
    expect(r.text).toContain('Ministry of the Interior and Safety')
    expect(r.glossaryApplied).toBeGreaterThan(0)
  })

  it('[FR-R117.4] dual-text 옵션', async () => {
    const b = new CrossLingualAIBridge({ translator: mockTranslator })
    const r = await b.translate({
      text: '공공기관',
      targetLang: 'en',
      grade: DataGrade.O,
      dualText: true,
    })
    expect(r.original).toBe('공공기관')
  })

  it('[FR-R117.7] PII 마스킹 후 번역', async () => {
    const b = new CrossLingualAIBridge({ translator: mockTranslator })
    const r = await b.translate({
      text: '이메일: user@example.com',
      targetLang: 'en',
      grade: DataGrade.O,
    })
    expect(r.piiMasked).toBeGreaterThan(0)
    expect(r.text).not.toContain('user@example.com')
  })

  it('[FR-R117.8] 감사 로그', async () => {
    const b = new CrossLingualAIBridge({ translator: mockTranslator })
    await b.translate({
      text: '행정안전부',
      targetLang: 'en',
      grade: DataGrade.O,
    })
    const log = b.getAuditLog()
    expect(log.some((e) => e.action === 'translate')).toBe(true)
    expect(log.some((e) => e.action === 'detectLang')).toBe(true)
  })
})
