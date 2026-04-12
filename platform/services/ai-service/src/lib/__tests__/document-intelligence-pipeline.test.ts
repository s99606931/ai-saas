/**
 * Tests — SVC-AI-ADV-R120 Document Intelligence Pipeline
 */

import { describe, it, expect } from 'vitest'
import {
  DocumentIntelligencePipeline,
  DataGrade,
  DefaultOCRStage,
  DefaultClassifyStage,
  DefaultStructureStage,
  type Stage,
  type StageResult,
} from '../document-intelligence-pipeline'

describe('DocumentIntelligencePipeline — R120', () => {
  it('FR-R120.2 + FR-R120.3: 기본 파이프라인 end-to-end 처리', async () => {
    const pipeline = new DocumentIntelligencePipeline().useDefaults()
    const result = await pipeline.process({
      id: 'doc-1',
      text: '민원 신청합니다. 신청인: 홍길동 2026-04-12 금액 50,000원 정보통신망법 참조',
      grade: DataGrade.O,
    })
    expect(result.category).toBe('민원신청')
    expect(result.entities.date).toBe('2026-04-12')
    expect(result.entities.amount).toContain('원')
    expect(result.entities.law).toContain('법')
    expect(result.skipped).toHaveLength(0)
    expect(result.structured).toHaveProperty('category')
  })

  it('FR-R120.1: 커스텀 스테이지 등록 가능', async () => {
    class EchoStage implements Stage<unknown, string> {
      name = 'ocr'
      async run(): Promise<StageResult<string>> {
        return { value: '에코 결과 증빙 확인서', confidence: 1, durationMs: 1 }
      }
    }
    const pipeline = new DocumentIntelligencePipeline()
      .addStage(new EchoStage())
      .addStage(new DefaultClassifyStage())
    const result = await pipeline.process({
      id: 'doc-2',
      grade: DataGrade.O,
    })
    expect(result.rawText).toBe('에코 결과 증빙 확인서')
    expect(result.category).toBe('증빙서류')
  })

  it('FR-R120.4: 단계 실패 시 skipOnFailure로 진행', async () => {
    class FailingStage implements Stage<unknown, string> {
      name = 'extract'
      async run(): Promise<StageResult<string>> {
        throw new Error('forced failure')
      }
    }
    const pipeline = new DocumentIntelligencePipeline({
      skipOnFailure: true,
      retries: 0,
    })
      .addStage(new DefaultOCRStage())
      .addStage(new DefaultClassifyStage())
      .addStage(new FailingStage())
      .addStage(new DefaultStructureStage())
    const result = await pipeline.process({
      id: 'doc-3',
      text: '민원 신청합니다',
      grade: DataGrade.O,
    })
    expect(result.skipped).toContain('extract')
    expect(result.category).toBe('민원신청')
  })

  it('FR-R120.4: skipOnFailure=false면 throw', async () => {
    class FailingStage implements Stage<unknown, string> {
      name = 'ocr'
      async run(): Promise<StageResult<string>> {
        throw new Error('boom')
      }
    }
    const pipeline = new DocumentIntelligencePipeline({
      skipOnFailure: false,
      retries: 0,
    }).addStage(new FailingStage())
    await expect(
      pipeline.process({ id: 'x', grade: DataGrade.O }),
    ).rejects.toThrow('boom')
  })

  it('FR-R120.5: DocumentPackage 필수 필드', async () => {
    const pipeline = new DocumentIntelligencePipeline().useDefaults()
    const result = await pipeline.process({
      id: 'doc-4',
      text: '공문 수신: 부처 발신: 담당관 문서번호 A-1',
      grade: DataGrade.O,
    })
    expect(result.id).toBe('doc-4')
    expect(result.category).toBe('공문')
    expect(result.stageConfidences).toHaveProperty('classify')
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0)
  })

  it('FR-R120.6: C등급 문서 차단', async () => {
    const pipeline = new DocumentIntelligencePipeline().useDefaults()
    await expect(
      pipeline.process({ id: 'c1', text: 'x', grade: DataGrade.C }),
    ).rejects.toThrow('BLOCKED')
  })

  it('FR-R120.6: S등급 차단', async () => {
    const pipeline = new DocumentIntelligencePipeline().useDefaults()
    await expect(
      pipeline.process({ id: 's1', text: 'x', grade: DataGrade.S }),
    ).rejects.toThrow('N2SF N-05')
  })

  it('FR-R120.7: structured 결과 PII 마스킹', async () => {
    const pipeline = new DocumentIntelligencePipeline().useDefaults()
    const result = await pipeline.process({
      id: 'doc-5',
      text: '신청인 연락처 admin@test.kr 전화 010-1111-2222',
      grade: DataGrade.O,
    })
    const json = JSON.stringify(result.structured)
    expect(json).toContain('[EMAIL]')
    expect(json).toContain('[PHONE]')
  })

  it('FR-R120.8: 감사 로그 기록 확인', async () => {
    const pipeline = new DocumentIntelligencePipeline().useDefaults()
    await pipeline.process({
      id: 'doc-6',
      text: '계약 당사자 합의',
      grade: DataGrade.O,
    })
    const log = pipeline.getAuditLog()
    expect(log.some((e) => e.action === 'process')).toBe(true)
    expect(log.some((e) => e.action === 'stageSuccess')).toBe(true)
  })

  it('retries로 일시적 실패 복구', async () => {
    let calls = 0
    class FlakyStage implements Stage<unknown, string> {
      name = 'ocr'
      async run(): Promise<StageResult<string>> {
        calls++
        if (calls < 2) throw new Error('transient')
        return { value: 'ok', confidence: 0.9, durationMs: 1 }
      }
    }
    const pipeline = new DocumentIntelligencePipeline({
      retries: 2,
      skipOnFailure: false,
    }).addStage(new FlakyStage())
    const result = await pipeline.process({ id: 'r1', grade: DataGrade.O })
    expect(result.rawText).toBe('ok')
    expect(calls).toBe(2)
  })
})
