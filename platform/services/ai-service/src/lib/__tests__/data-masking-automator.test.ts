import { describe, it, expect, beforeEach } from 'vitest'
import { DataMaskingAutomator } from '../data-masking-automator'

describe('DataMaskingAutomator', () => {
  let automator: DataMaskingAutomator

  beforeEach(() => {
    automator = new DataMaskingAutomator()
  })

  it('주민등록번호 마스킹', () => {
    const result = automator.maskText('주민번호는 900101-1234567입니다')
    expect(result.masked).toContain('######-#######')
    expect(result.masked).not.toContain('900101-1234567')
    expect(result.maskCount).toBe(1)
  })

  it('전화번호 마스킹', () => {
    const result = automator.maskText('010-1234-5678로 연락 바랍니다')
    expect(result.masked).not.toContain('010-1234-5678')
    expect(result.maskCount).toBe(1)
  })

  it('이메일 마스킹', () => {
    const result = automator.maskText('이메일: user@example.com')
    expect(result.masked).not.toContain('user@example.com')
    expect(result.maskCount).toBe(1)
  })

  it('복수 PII 동시 마스킹', () => {
    const result = automator.maskText('전화 010-9999-8888, 이메일 admin@gov.kr')
    expect(result.maskCount).toBe(2)
    expect(result.appliedPatterns.length).toBe(2)
  })

  it('구조화 데이터 sensitiveFields 마스킹', () => {
    const record = { name: '홍길동', phone: '010-1234-5678', department: '기획부' }
    const masked = automator.maskRecord(record, ['phone'])
    expect(masked['phone']).not.toContain('1234')
    expect(masked['name']).toBe('홍길동')
    expect(masked['department']).toBe('기획부')
  })

  it('커스텀 패턴 등록 후 적용', () => {
    automator.registerPattern({ patternId: 'P-CUSTOM', name: '사번', regex: 'EMP-\\d{6}', replacement: 'EMP-######', priority: 10 })
    const result = automator.maskText('사번: EMP-123456')
    expect(result.masked).toContain('EMP-######')
  })

  it('통계 누적 확인', () => {
    automator.maskText('010-1111-2222 010-3333-4444')
    const stats = automator.getStats()
    const phoneStat = stats.find((s) => s.patternId === 'P-PHONE')
    expect(phoneStat!.totalApplied).toBe(2)
  })
})
