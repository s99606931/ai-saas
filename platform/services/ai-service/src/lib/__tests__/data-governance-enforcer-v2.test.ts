// Plan SC: SVC-AI-ADV-R557-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { DataGovernanceEnforcerV2, type GovernancePolicy, type DataRecord } from '../data-governance-enforcer-v2'

describe('DataGovernanceEnforcerV2', () => {
  let enforcer: DataGovernanceEnforcerV2

  const policy: GovernancePolicy = {
    policyId: 'POL-1',
    name: '기본 거버넌스 정책',
    maxRetentionDays: 365,
    requireEncryption: true,
    maxAccessCount: 100,
    allowedGrades: ['O'],
  }

  const validRecord: DataRecord = {
    recordId: 'REC-1',
    grade: 'O',
    retentionDays: 100,
    encrypted: true,
    accessCount: 50,
    piiFields: ['name', 'email'],
    ownerId: 'owner@gov.kr',
  }

  beforeEach(() => {
    enforcer = new DataGovernanceEnforcerV2()
    enforcer.registerPolicy(policy)
  })

  it('N2SF: C등급 데이터 처리 차단', () => {
    expect(() => enforcer.enforcePolicy({ ...validRecord, recordId: 'REC-C', grade: 'C' })).toThrow('BLOCKED')
  })

  it('N2SF: S등급 데이터 처리 차단', () => {
    expect(() => enforcer.enforcePolicy({ ...validRecord, recordId: 'REC-S', grade: 'S' })).toThrow('BLOCKED')
  })

  it('O등급 + PII 필드 → 마스킹 적용', () => {
    const result = enforcer.enforcePolicy(validRecord)
    expect(result.maskedFields).toContain('name')
    expect(result.maskedFields).toContain('email')
  })

  it('보존 기간 초과 → RETENTION_EXCEEDED 위반', () => {
    const result = enforcer.enforcePolicy({ ...validRecord, recordId: 'REC-RET', retentionDays: 400 })
    expect(result.violations.some((v) => v.type === 'RETENTION_EXCEEDED')).toBe(true)
  })

  it('암호화 미적용 → MISSING_ENCRYPTION CRITICAL 위반', () => {
    const result = enforcer.enforcePolicy({ ...validRecord, recordId: 'REC-ENC', encrypted: false })
    expect(result.violations.some((v) => v.type === 'MISSING_ENCRYPTION' && v.severity === 'CRITICAL')).toBe(true)
  })

  it('접근 횟수 초과 → EXCESSIVE_ACCESS 위반', () => {
    const result = enforcer.enforcePolicy({ ...validRecord, recordId: 'REC-ACC', accessCount: 200 })
    expect(result.violations.some((v) => v.type === 'EXCESSIVE_ACCESS')).toBe(true)
  })

  it('detectViolations: C등급 데이터 → GRADE_VIOLATION CRITICAL', () => {
    const violations = enforcer.detectViolations([{ ...validRecord, grade: 'C' }])
    expect(violations.some((v) => v.type === 'GRADE_VIOLATION' && v.severity === 'CRITICAL')).toBe(true)
  })

  it('generateReport: 위반 요약 반환', () => {
    enforcer.enforcePolicy({ ...validRecord, recordId: 'REC-BAD', encrypted: false })
    const report = enforcer.generateReport()
    expect(report.totalViolations).toBeGreaterThan(0)
    expect(report.generatedAt).toBeTruthy()
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    enforcer.enforcePolicy(validRecord)
    const log1 = enforcer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', recordId: 'X', detail: {} })
    const log2 = enforcer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
