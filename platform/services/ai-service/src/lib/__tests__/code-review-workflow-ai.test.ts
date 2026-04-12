import { describe, it, expect, beforeEach } from 'vitest'
import { CodeReviewWorkflowAI } from '../code-review-workflow-ai'
import type { ReviewFinding } from '../code-review-workflow-ai'

describe('CodeReviewWorkflowAI', () => {
  let reviewer: CodeReviewWorkflowAI

  beforeEach(() => {
    reviewer = new CodeReviewWorkflowAI()
  })

  it('이슈 없는 PR — APPROVED', () => {
    const result = reviewer.review({ prId: 'PR-1', title: '버그 수정', author: 'dev1', changedFiles: ['fix.ts'], linesAdded: 10, linesRemoved: 5, targetBranch: 'main' }, [])
    expect(result.status).toBe('APPROVED')
    expect(result.approvalScore).toBe(100)
  })

  it('CRITICAL 이슈 — REJECTED', () => {
    const findings: ReviewFinding[] = [
      { findingId: 'F-1', file: 'auth.ts', severity: 'CRITICAL', category: 'SECURITY', message: 'SQL injection' },
    ]
    const result = reviewer.review({ prId: 'PR-2', title: '기능 추가', author: 'dev2', changedFiles: ['auth.ts'], linesAdded: 20, linesRemoved: 0, targetBranch: 'main' }, findings)
    expect(result.status).toBe('REJECTED')
    expect(result.blockers).toBeGreaterThan(0)
  })

  it('HIGH 이슈 — CHANGES_REQUESTED', () => {
    const findings: ReviewFinding[] = [
      { findingId: 'F-2', file: 'api.ts', severity: 'HIGH', category: 'SECURITY', message: '보안 취약점' },
    ]
    const result = reviewer.review({ prId: 'PR-3', title: 'API 수정', author: 'dev3', changedFiles: ['api.ts'], linesAdded: 50, linesRemoved: 10, targetBranch: 'main' }, findings)
    expect(result.status).toBe('CHANGES_REQUESTED')
  })

  it('대규모 PR — AUTO 경고 추가', () => {
    const result = reviewer.review({ prId: 'PR-4', title: '대규모 리팩토링', author: 'dev4', changedFiles: ['a.ts', 'b.ts'], linesAdded: 400, linesRemoved: 200, targetBranch: 'main' }, [])
    expect(result.findings.some((f) => f.message.includes('대규모'))).toBe(true)
  })

  it('민감 파일 변경 — AUTO 보안 경고 추가', () => {
    const result = reviewer.review({ prId: 'PR-5', title: '설정 변경', author: 'dev5', changedFiles: ['secret.env', 'config.ts'], linesAdded: 5, linesRemoved: 2, targetBranch: 'main' }, [])
    expect(result.findings.some((f) => f.category === 'SECURITY')).toBe(true)
  })

  it('감사 로그 복사본 반환', () => {
    reviewer.review({ prId: 'PR-6', title: '테스트', author: 'dev', changedFiles: [], linesAdded: 1, linesRemoved: 0, targetBranch: 'main' }, [])
    const log = reviewer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', prId: 'X', detail: {} })
    expect(reviewer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
