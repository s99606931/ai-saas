import { describe, it, expect, beforeEach } from 'vitest'
import { CodeQualityImproverAI } from '../code-quality-improver-ai'
import type { CodeIssue } from '../code-quality-improver-ai'

describe('CodeQualityImproverAI', () => {
  let improver: CodeQualityImproverAI

  beforeEach(() => {
    improver = new CodeQualityImproverAI()
  })

  it('이슈 없음 — qualityScore=100, passed=true', () => {
    const report = improver.analyze([], 10)
    expect(report.qualityScore).toBe(100)
    expect(report.passed).toBe(true)
    expect(report.totalIssues).toBe(0)
  })

  it('CRITICAL 이슈 — passed=false', () => {
    const issues: CodeIssue[] = [
      { issueId: 'I-1', file: 'auth.ts', line: 10, type: 'SECURITY', severity: 'CRITICAL', message: 'SQL injection' },
    ]
    const report = improver.analyze(issues, 5)
    expect(report.passed).toBe(false)
    expect(report.issuesBySeverity.CRITICAL).toBe(1)
  })

  it('점수 감점 계산 — CRITICAL×20', () => {
    const issues: CodeIssue[] = [
      { issueId: 'I-1', file: 'a.ts', line: 1, type: 'SECURITY', severity: 'CRITICAL', message: '이슈' },
      { issueId: 'I-2', file: 'b.ts', line: 2, type: 'STYLE', severity: 'LOW', message: '스타일' },
    ]
    const report = improver.analyze(issues, 3)
    expect(report.qualityScore).toBe(100 - 20 - 1)
  })

  it('이슈 유형별 집계', () => {
    const issues: CodeIssue[] = [
      { issueId: 'I-1', file: 'a.ts', line: 1, type: 'SECURITY', severity: 'HIGH', message: '보안' },
      { issueId: 'I-2', file: 'b.ts', line: 2, type: 'PERFORMANCE', severity: 'MEDIUM', message: '성능' },
      { issueId: 'I-3', file: 'c.ts', line: 3, type: 'SECURITY', severity: 'MEDIUM', message: '보안2' },
    ]
    const report = improver.analyze(issues, 5)
    expect(report.issuesByType.SECURITY).toBe(2)
    expect(report.issuesByType.PERFORMANCE).toBe(1)
  })

  it('topIssues — CRITICAL 우선 정렬', () => {
    const issues: CodeIssue[] = [
      { issueId: 'I-1', file: 'a.ts', line: 1, type: 'STYLE', severity: 'LOW', message: '스타일' },
      { issueId: 'I-2', file: 'b.ts', line: 2, type: 'SECURITY', severity: 'CRITICAL', message: '보안' },
    ]
    const report = improver.analyze(issues, 5)
    expect(report.topIssues[0]!.severity).toBe('CRITICAL')
  })

  it('감사 로그 복사본 반환', () => {
    improver.analyze([], 1)
    const log = improver.getAuditLog()
    log.push({ timestamp: '', action: 'injected', detail: {} })
    expect(improver.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
