// Plan SC: SVC-AI-ADV-R490-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicAdminLanguageCorrectorV3, type TextDocument } from '../public-admin-language-corrector-v3'

describe('PublicAdminLanguageCorrectorV3', () => {
  let corrector: PublicAdminLanguageCorrectorV3

  const cleanDoc: TextDocument = {
    docId: 'DOC-1',
    title: '민원 처리 안내',
    content: '신청하신 민원을 처리합니다. 궁금한 점은 해당 부서로 문의해 주세요.',
    targetAudience: 'CITIZEN',
  }

  beforeEach(() => {
    corrector = new PublicAdminLanguageCorrectorV3()
  })

  it('미등록 문서 교정 시 오류 발생', () => {
    expect(() => corrector.correct('UNKNOWN')).toThrow('Unknown document')
  })

  it('클린 문서 → corrections=0, plainLanguageCompliant=true', () => {
    corrector.registerDocument(cleanDoc)
    const report = corrector.correct('DOC-1')
    expect(report.plainLanguageCompliant).toBe(true)
    expect(report.corrections.filter((c) => c.severity === 'REQUIRED')).toHaveLength(0)
  })

  it('행정 전문 용어 → JARGON 교정 포함', () => {
    corrector.registerDocument({
      ...cleanDoc,
      docId: 'DOC-JARGON',
      content: '당해 사항은 익일 시행합니다.',
    })
    const report = corrector.correct('DOC-JARGON')
    expect(report.corrections.some((c) => c.category === 'JARGON')).toBe(true)
  })

  it('대민 문서 외래어 → FOREIGN_TERM 교정 포함', () => {
    corrector.registerDocument({
      ...cleanDoc,
      docId: 'DOC-FOREIGN',
      content: '해당 프로세스를 매뉴얼에 따라 진행하세요.',
    })
    const report = corrector.correct('DOC-FOREIGN')
    expect(report.corrections.some((c) => c.category === 'FOREIGN_TERM')).toBe(true)
  })

  it('대민 문서 필수 교정 존재 → plainLanguageCompliant=false', () => {
    corrector.registerDocument({
      ...cleanDoc,
      docId: 'DOC-REQ',
      content: '귀하의 익일 시행 건에 대해 안내 드립니다.',
    })
    const report = corrector.correct('DOC-REQ')
    // 'CITIZEN' 대상 JARGON → REQUIRED
    expect(report.plainLanguageCompliant).toBe(false)
  })

  it('readabilityScore: REQUIRED 교정 많을수록 낮아짐', () => {
    corrector.registerDocument({
      ...cleanDoc,
      docId: 'DOC-LOW',
      content: '귀하, 익일, 당해, 차후, 추후 사항을 하기에 기재합니다.',
    })
    const report = corrector.correct('DOC-LOW')
    expect(report.readabilityScore).toBeLessThan(100)
  })

  it('이중 피동 표현 → PASSIVE_VOICE 교정', () => {
    corrector.registerDocument({
      ...cleanDoc,
      docId: 'DOC-PASS',
      content: '신청서가 접수되어집니다.',
    })
    const report = corrector.correct('DOC-PASS')
    expect(report.corrections.some((c) => c.category === 'PASSIVE_VOICE')).toBe(true)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    corrector.registerDocument(cleanDoc)
    corrector.correct('DOC-1')
    const log1 = corrector.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', docId: 'X', detail: {} })
    const log2 = corrector.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
