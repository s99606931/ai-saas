/**
 * Unit tests for Zero-Shot Classifier — SVC-AI-ADV-R92
 */

import { describe, it, expect, vi } from 'vitest'
import {
  ZeroShotClassifier,
  type EmbeddingClient,
  type CategoryLabel,
  type AuditSink,
} from '../zero-shot-classifier'

/** Fake embedder producing deterministic vectors keyed by text hash. */
const makeEmbedder = (map: Record<string, number[]>): EmbeddingClient => ({
  embed: vi.fn(async (text: string) => {
    for (const key of Object.keys(map)) {
      if (text.includes(key)) return map[key]!
    }
    return [0.1, 0.1, 0.1]
  }),
})

const cats: CategoryLabel[] = [
  { id: 'welfare', name: '복지', description: '사회복지 서비스 문의' },
  { id: 'tax', name: '세무', description: '세금 및 납부 문의' },
  { id: 'env', name: '환경', description: '환경 오염 신고' },
]

describe('SVC-AI-ADV-R92 ZeroShotClassifier', () => {
  it('[FR-R92.2] classifies document to best matching category', async () => {
    const embedder = makeEmbedder({
      복지: [1, 0, 0],
      세무: [0, 1, 0],
      환경: [0, 0, 1],
      '기초생활수급': [1, 0, 0],
    })
    const clf = new ZeroShotClassifier({ embedder })
    const result = await clf.classify(
      'doc-1',
      '기초생활수급 신청 관련 문의',
      cats,
    )
    expect(result.topK[0]!.categoryId).toBe('welfare')
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('[FR-R92.5] masks PII (주민번호, 전화, 이메일)', async () => {
    const embedder = makeEmbedder({ 복지: [1, 0, 0] })
    const clf = new ZeroShotClassifier({ embedder })
    const result = await clf.classify(
      'doc-2',
      '주민번호 900101-1234567 전화 010-1234-5678 이메일 test@gov.kr',
      cats,
    )
    expect(result.maskedText).toContain('***-******')
    expect(result.maskedText).toContain('***-****-****')
    expect(result.maskedText).toContain('***@***')
    expect(result.maskedText).not.toContain('900101-1234567')
  })

  it('[FR-R92.4] low margin triggers manualReview', async () => {
    const embedder: EmbeddingClient = {
      embed: vi.fn(async (text: string) => {
        if (text.startsWith('복지')) return [1, 0.01, 0]
        if (text.startsWith('세무')) return [0.99, 0.02, 0]
        if (text.startsWith('환경')) return [0, 0, 1]
        return [1, 0, 0] // 문서 = 복지, 세무 둘 다 매우 유사
      }),
    }
    const clf = new ZeroShotClassifier({ embedder })
    const result = await clf.classify('doc-3', '애매한 문의', cats)
    expect(result.requiresManualReview).toBe(true)
  })

  it('[FR-R92.1] throws on empty categories', async () => {
    const embedder = makeEmbedder({})
    const clf = new ZeroShotClassifier({ embedder })
    await expect(clf.classify('doc-4', 'text', [])).rejects.toThrow(
      /categories/,
    )
  })

  it('[FR-R92.3] topK option respected', async () => {
    const embedder = makeEmbedder({
      복지: [1, 0, 0],
      세무: [0, 1, 0],
      환경: [0, 0, 1],
    })
    const clf = new ZeroShotClassifier({ embedder })
    const result = await clf.classify('doc-5', '기타 문의', cats, { topK: 2 })
    expect(result.topK).toHaveLength(2)
  })

  it('audit logs classification', async () => {
    const embedder = makeEmbedder({ 복지: [1, 0, 0] })
    const audit: AuditSink = { log: vi.fn().mockResolvedValue(undefined) }
    const clf = new ZeroShotClassifier({ embedder, audit })
    await clf.classify('doc-6', '복지 서비스 문의', cats)
    expect(audit.log).toHaveBeenCalledWith(
      'zeroshot.classify',
      expect.objectContaining({ documentId: 'doc-6' }),
    )
  })

  it('category embedding is cached (single embed per category across calls)', async () => {
    const embedder = makeEmbedder({ 복지: [1, 0, 0] })
    const clf = new ZeroShotClassifier({ embedder })
    await clf.classify('doc-7', 'text1', cats)
    await clf.classify('doc-8', 'text2', cats)
    // cats(3) 카테고리 임베딩 + doc1 + doc2 = 5 call
    expect(embedder.embed).toHaveBeenCalledTimes(5)
  })
})
