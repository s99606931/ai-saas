import { describe, it, expect, beforeEach } from 'vitest'
import { AutoDataClassifierV2, type DataRecord } from '../auto-data-classifier-v2'

describe('AutoDataClassifierV2', () => {
  let classifier: AutoDataClassifierV2

  beforeEach(() => {
    classifier = new AutoDataClassifierV2()
  })

  it('SSN 패턴 → C등급', () => {
    const record: DataRecord = {
      recordId: 'REC001',
      fields: [{ fieldName: 'idNumber', sampleValues: ['901010-1234567'] }],
    }
    const result = classifier.classify(record)
    expect(result.grade).toBe('C')
    expect(result.detectedPatterns.some((p) => p.patternType === 'SSN')).toBe(true)
  })

  it('이메일 패턴 → S등급', () => {
    const record: DataRecord = {
      recordId: 'REC002',
      fields: [{ fieldName: 'email', sampleValues: ['user@gov.kr'] }],
    }
    const result = classifier.classify(record)
    expect(result.grade).toBe('S')
    expect(result.detectedPatterns.some((p) => p.patternType === 'EMAIL')).toBe(true)
  })

  it('패턴 없으면 O등급', () => {
    const record: DataRecord = {
      recordId: 'REC003',
      fields: [{ fieldName: 'description', sampleValues: ['일반 텍스트 내용'] }],
    }
    const result = classifier.classify(record)
    expect(result.grade).toBe('O')
    expect(result.detectedPatterns.length).toBe(0)
  })

  it('SSN + EMAIL 혼합 → C등급 (최고 등급 우선)', () => {
    const record: DataRecord = {
      recordId: 'REC004',
      fields: [
        { fieldName: 'ssn', sampleValues: ['851201-2345678'] },
        { fieldName: 'email', sampleValues: ['admin@mois.go.kr'] },
      ],
    }
    const result = classifier.classify(record)
    expect(result.grade).toBe('C')
  })

  it('C등급 → AI API 전송 금지 권고사항', () => {
    const record: DataRecord = {
      recordId: 'REC005',
      fields: [{ fieldName: 'ssn', sampleValues: ['700101-1234567'] }],
    }
    const result = classifier.classify(record)
    expect(result.recommendations.some((r) => r.includes('AI API'))).toBe(true)
  })

  it('분류 후 감사 로그', () => {
    const record: DataRecord = {
      recordId: 'REC006',
      fields: [{ fieldName: 'name', sampleValues: ['홍길동'] }],
    }
    classifier.classify(record)
    const log = classifier.getAuditLog()
    expect(log.some((e) => e.action === 'data.classify')).toBe(true)
  })
})
