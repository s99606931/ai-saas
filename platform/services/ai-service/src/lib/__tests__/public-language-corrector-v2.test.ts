// Plan SC: SVC-AI-ADV-R399-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicLanguageCorrectorV2 } from '../public-language-corrector-v2'

describe('PublicLanguageCorrectorV2', () => {
  let corrector: PublicLanguageCorrectorV2

  beforeEach(() => {
    corrector = new PublicLanguageCorrectorV2()
  })

  it('N2SF: C등급 문서 교정 차단', () => {
    expect(() =>
      corrector.correct({ textId: 'T1', content: '비밀 내용', documentType: 'NOTICE', grade: 'C' })
    ).toThrow('BLOCKED')
  })

  it('N2SF: S등급 문서 교정 차단', () => {
    expect(() =>
      corrector.correct({ textId: 'T2', content: '기밀 내용', documentType: 'NOTICE', grade: 'S' })
    ).toThrow('BLOCKED')
  })

  it('전문 용어 교정: 인터페이스 → 화면', () => {
    const result = corrector.correct({ textId: 'T3', content: '시스템 인터페이스를 통해 업로드합니다.', documentType: 'GUIDE', grade: 'O' })
    expect(result.correctedText).toContain('화면')
    expect(result.correctedText).toContain('올리기')
    const jargonCorrection = result.corrections.find((c) => c.type === 'JARGON')
    expect(jargonCorrection).toBeDefined()
  })

  it('비공식 표현 교정: 해요 → 합니다', () => {
    const result = corrector.correct({ textId: 'T4', content: '신청 해요. 근데 절차가 복잡합니다.', documentType: 'FORM', grade: 'O' })
    const formalCorrection = result.corrections.find((c) => c.type === 'FORMAL')
    expect(formalCorrection).toBeDefined()
    expect(result.correctedText).not.toContain('근데')
  })

  it('가독성 점수: 짧은 문장 → 높은 점수', () => {
    const result = corrector.correct({ textId: 'T5', content: '신청하십시오. 제출합니다. 확인합니다.', documentType: 'NOTICE', grade: 'O' })
    expect(result.readabilityScore).toBeGreaterThan(50)
  })

  it('격식 점수: 공식 종결어미 비율 반영', () => {
    const result = corrector.correct({
      textId: 'T6',
      content: '본 서비스는 공공기관에서 운영합니다. 이용자는 본인 인증을 완료해야 합니다. 미완료 시 서비스 이용이 제한됩니다.',
      documentType: 'ANNOUNCEMENT',
      grade: 'O',
    })
    expect(result.formalityScore).toBeGreaterThan(50)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    corrector.correct({ textId: 'T7', content: '시스템 로그인 처리합니다.', documentType: 'GUIDE', grade: 'O' })
    const log1 = corrector.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', textId: 'X', detail: {} })
    const log2 = corrector.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
