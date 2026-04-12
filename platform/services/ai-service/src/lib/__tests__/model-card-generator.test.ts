/**
 * Tests — SVC-AI-ADV-R157 Model Card Generator
 */

import { describe, it, expect } from 'vitest'
import { ModelCardGenerator, type ModelCardMeta } from '../model-card-generator'

function makeGenerator() {
  let t = 1_700_000_000_000
  return new ModelCardGenerator({
    now: () => {
      t += 1
      return t
    },
  })
}

function validMeta(): ModelCardMeta {
  return {
    name: 'PublicGPT',
    version: '1.0.0',
    purpose: '공공 민원 Q&A 응답 생성',
    owner: '행정안전부 AI팀',
    trainingData: '공개 법령 + 내부 FAQ (O등급)',
    evaluation: 'BLEU 0.42, 정확도 87%',
    limitations: '최신 법령 반영 지연 가능',
    ethicalConsiderations: '편향 검증 주기 분기별 1회',
  }
}

describe('ModelCardGenerator', () => {
  it('필수 필드 모두 있으면 생성 성공', () => {
    const g = makeGenerator()
    const out = g.build(validMeta())
    expect(out.markdown.length).toBeGreaterThan(0)
    expect(out.json.name).toBe('PublicGPT')
    expect(out.json.version).toBe('1.0.0')
  })

  it('name 누락 시 missing_field 오류', () => {
    const g = makeGenerator()
    const meta = { ...validMeta(), name: '' }
    expect(() => g.build(meta)).toThrow(/missing_field/)
  })

  it('purpose 누락 시 missing_field 오류', () => {
    const g = makeGenerator()
    const meta = { ...validMeta(), purpose: '   ' }
    expect(() => g.build(meta)).toThrow(/missing_field/)
  })

  it('version 형식 위반 → invalid_version', () => {
    const g = makeGenerator()
    const meta = { ...validMeta(), version: '1.0' }
    expect(() => g.build(meta)).toThrow('invalid_version')
    const meta2 = { ...validMeta(), version: 'v1.0.0' }
    expect(() => g.build(meta2)).toThrow('invalid_version')
  })

  it('Markdown 은 8개 섹션을 포함한다', () => {
    const g = makeGenerator()
    const out = g.build(validMeta())
    expect(out.markdown).toContain('## 1. 개요')
    expect(out.markdown).toContain('## 2. 목적')
    expect(out.markdown).toContain('## 3. 학습 데이터')
    expect(out.markdown).toContain('## 4. 평가 지표')
    expect(out.markdown).toContain('## 5. 한계')
    expect(out.markdown).toContain('## 6. 윤리적 고려사항')
    expect(out.markdown).toContain('## 7. 소유자')
    expect(out.markdown).toContain('## 8. 변경 이력')
  })

  it('JSON 은 생성시각과 변경이력을 포함한다', () => {
    const g = makeGenerator()
    const out = g.build({
      ...validMeta(),
      changelog: [{ version: '1.0.0', date: '2026-04-12', note: '최초 릴리즈' }],
    })
    expect(typeof out.json.generatedAt).toBe('string')
    const changelog = out.json.changelog as unknown[]
    expect(changelog).toHaveLength(1)
  })

  it('validateChecklist 는 8개 섹션 충족 시 true', () => {
    const g = makeGenerator()
    const out = g.build(validMeta())
    expect(g.validateChecklist(out)).toBe(true)
  })

  it('C/S 등급은 차단된다', () => {
    const g = makeGenerator()
    expect(() => g.build(validMeta(), 'C')).toThrow('grade_blocked')
    expect(() => g.build(validMeta(), 'S')).toThrow('grade_blocked')
  })

  it('감사 로그는 기록된다', () => {
    const g = makeGenerator()
    g.build(validMeta())
    const log = g.getAuditLog()
    expect(log.map((e) => e.event)).toContain('built')
  })
})
