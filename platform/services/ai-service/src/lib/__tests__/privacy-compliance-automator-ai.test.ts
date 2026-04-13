import { describe, it, expect, beforeEach } from 'vitest'
import { PrivacyComplianceAutomatorAi, type DataProcessingRecord } from '../privacy-compliance-automator-ai'

describe('PrivacyComplianceAutomatorAi', () => {
  let ai: PrivacyComplianceAutomatorAi

  const compliantRecord: DataProcessingRecord = {
    recordId: 'REC001',
    purpose: '민원 처리',
    fields: [
      { fieldName: 'userName', piiCategory: 'NAME', encrypted: false, masked: false, retentionDays: 365 },
      { fieldName: 'ssn', piiCategory: 'SSN', encrypted: true, masked: true, retentionDays: 365 },
      { fieldName: 'bankAccount', piiCategory: 'BANK_ACCOUNT', encrypted: true, masked: true, retentionDays: 365 },
    ],
    consentObtained: true,
    legalBasis: '민원처리법 제10조',
  }

  beforeEach(() => {
    ai = new PrivacyComplianceAutomatorAi()
    ai.registerRecord(compliantRecord)
  })

  it('동의 미획득 + 법적 근거 없음 에러', () => {
    expect(() => ai.registerRecord({ ...compliantRecord, recordId: 'REC_INVALID', consentObtained: false, legalBasis: '' })).toThrow()
  })

  it('레코드 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'record.register')).toBe(true)
  })

  it('준수 레코드 → COMPLIANT', () => {
    const report = ai.audit('REC001')
    expect(report.status).toBe('COMPLIANT')
    expect(report.complianceScore).toBe(100)
  })

  it('SSN 암호화 미적용 → CRITICAL NOT_ENCRYPTED', () => {
    ai.registerRecord({
      ...compliantRecord,
      recordId: 'REC002',
      fields: [{ fieldName: 'ssn', piiCategory: 'SSN', encrypted: false, masked: true, retentionDays: 365 }],
    })
    const report = ai.audit('REC002')
    expect(report.status).toBe('VIOLATION')
    expect(report.violations.some((v) => v.violationType === 'NOT_ENCRYPTED')).toBe(true)
  })

  it('PHONE 마스킹 미적용 → HIGH NOT_MASKED', () => {
    ai.registerRecord({
      ...compliantRecord,
      recordId: 'REC003',
      fields: [{ fieldName: 'phone', piiCategory: 'PHONE', encrypted: false, masked: false, retentionDays: 30 }],
    })
    const report = ai.audit('REC003')
    expect(report.violations.some((v) => v.violationType === 'NOT_MASKED')).toBe(true)
  })

  it('보존 기간 5년 초과 → EXCESSIVE_RETENTION', () => {
    ai.registerRecord({
      ...compliantRecord,
      recordId: 'REC004',
      fields: [{ fieldName: 'name', piiCategory: 'NAME', encrypted: false, masked: false, retentionDays: 2000 }],
    })
    const report = ai.audit('REC004')
    expect(report.violations.some((v) => v.violationType === 'EXCESSIVE_RETENTION')).toBe(true)
  })

  it('미등록 레코드 에러', () => {
    expect(() => ai.audit('UNKNOWN')).toThrow()
  })

  it('감사 후 로그 기록', () => {
    ai.audit('REC001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'privacy.audit')).toBe(true)
  })
})
