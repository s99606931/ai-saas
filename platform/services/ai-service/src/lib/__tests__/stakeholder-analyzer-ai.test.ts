// Design Ref: §R418 — AI기반 공공기관 이해관계자 분석
import { describe, it, expect, beforeEach } from 'vitest'
import { StakeholderAnalyzerAi } from '../stakeholder-analyzer-ai'

describe('StakeholderAnalyzerAi', () => {
  let analyzer: StakeholderAnalyzerAi

  beforeEach(() => {
    analyzer = new StakeholderAnalyzerAi()
  })

  it('MANAGE_CLOSELY: HIGH영향+HIGH관심(≥5)', () => {
    analyzer.registerStakeholder({ stakeholderId: 'STK-00001', name: '장관', organization: '행안부', influenceLevel: 8, interestLevel: 7 })
    const report = analyzer.analyze('PRJ-001')
    expect(report.analyses[0]?.quadrant).toBe('MANAGE_CLOSELY')
    expect(report.criticalStakeholders.length).toBeGreaterThan(0)
  })

  it('KEEP_SATISFIED: HIGH영향+LOW관심', () => {
    analyzer.registerStakeholder({ stakeholderId: 'STK-00002', name: '예산담당', organization: '기재부', influenceLevel: 7, interestLevel: 3 })
    const report = analyzer.analyze('PRJ-002')
    expect(report.analyses[0]?.quadrant).toBe('KEEP_SATISFIED')
  })

  it('KEEP_INFORMED: LOW영향+HIGH관심', () => {
    analyzer.registerStakeholder({ stakeholderId: 'STK-00003', name: '시민단체', organization: '시민단체', influenceLevel: 2, interestLevel: 9 })
    const report = analyzer.analyze('PRJ-003')
    expect(report.analyses[0]?.quadrant).toBe('KEEP_INFORMED')
  })

  it('MONITOR: LOW영향+LOW관심', () => {
    analyzer.registerStakeholder({ stakeholderId: 'STK-00004', name: '일반직원', organization: '부처', influenceLevel: 1, interestLevel: 2 })
    const report = analyzer.analyze('PRJ-004')
    expect(report.analyses[0]?.quadrant).toBe('MONITOR')
  })

  it('PII: maskedId에 원본 미포함', () => {
    analyzer.registerStakeholder({ stakeholderId: 'STK-00005', name: '테스트', organization: '기관', influenceLevel: 6, interestLevel: 6 })
    const report = analyzer.analyze('PRJ-005')
    expect(report.analyses[0]?.maskedId).not.toBe('STK-00005')
    expect(report.analyses[0]?.maskedId).toContain('*')
  })

  it('복수 이해관계자 분석', () => {
    analyzer.registerStakeholder({ stakeholderId: 'STK-A0001', name: 'A', organization: 'O1', influenceLevel: 9, interestLevel: 8 })
    analyzer.registerStakeholder({ stakeholderId: 'STK-B0001', name: 'B', organization: 'O2', influenceLevel: 2, interestLevel: 2 })
    const report = analyzer.analyze('PRJ-006')
    expect(report.totalStakeholders).toBe(2)
  })

  it('감사 로그에 stakeholder.analyze 기록', () => {
    analyzer.registerStakeholder({ stakeholderId: 'STK-L0001', name: 'L', organization: 'LOG', influenceLevel: 5, interestLevel: 5 })
    analyzer.analyze('PRJ-007')
    const logs = analyzer.getAuditLog()
    expect(logs.some((l) => l.action === 'stakeholder.analyze')).toBe(true)
  })
})
