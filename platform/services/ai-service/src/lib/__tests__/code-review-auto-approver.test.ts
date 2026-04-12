import { describe, it, expect, beforeEach } from 'vitest'
import { CodeReviewAutoApprover } from '../code-review-auto-approver'

describe('CodeReviewAutoApprover', () => {
  let approver: CodeReviewAutoApprover

  beforeEach(() => {
    approver = new CodeReviewAutoApprover()
  })

  it('변경 없는 PR은 AUTO_APPROVE', () => {
    const result = approver.evaluatePr({ prId: 'PR-1', title: '문서 수정', files: [
      { path: 'README.md', additions: 5, deletions: 2 },
    ] })
    expect(result.decision).toBe('AUTO_APPROVE')
    expect(result.totalScore).toBe(0)
  })

  it('.env 파일 변경은 BLOCK (score 80)', () => {
    const result = approver.evaluatePr({ prId: 'PR-2', title: 'env 수정', files: [
      { path: '.env.production', additions: 1, deletions: 0 },
    ] })
    expect(result.decision).toBe('BLOCK')
    expect(result.totalScore).toBeGreaterThanOrEqual(80)
  })

  it('.pem 인증서 변경은 BLOCK', () => {
    const result = approver.evaluatePr({ prId: 'PR-3', title: '인증서', files: [
      { path: 'certs/server.pem', additions: 10, deletions: 0 },
    ] })
    expect(result.decision).toBe('BLOCK')
  })

  it('migration 변경은 REQUEST_REVIEW', () => {
    const result = approver.evaluatePr({ prId: 'PR-4', title: 'DB 마이그레이션', files: [
      { path: 'db/migration/0001_init.sql', additions: 20, deletions: 0 },
    ] })
    expect(result.decision).toBe('REQUEST_REVIEW')
    expect(result.triggeredRules).toContain('DB 마이그레이션 변경')
  })

  it('500라인 초과 대규모 변경은 점수 +20', () => {
    const result = approver.evaluatePr({ prId: 'PR-5', title: '대규모', files: [
      { path: 'src/app.ts', additions: 400, deletions: 150 },
    ] })
    expect(result.triggeredRules).toContain('대규모 변경 (+500 lines)')
    expect(result.totalScore).toBeGreaterThanOrEqual(20)
  })

  it('커스텀 규칙 등록 및 적용', () => {
    approver.registerRiskRule({ ruleId: 'R-CUSTOM', pattern: 'billing', riskScore: 60, description: '결제 모듈' })
    const result = approver.evaluatePr({ prId: 'PR-6', title: '결제', files: [
      { path: 'src/billing/invoice.ts', additions: 5, deletions: 0 },
    ] })
    expect(result.totalScore).toBeGreaterThanOrEqual(60)
    expect(result.triggeredRules).toContain('결제 모듈')
  })

  it('감사 로그가 복사본임을 확인', () => {
    approver.evaluatePr({ prId: 'PR-7', title: 'test', files: [] })
    const log = approver.getAuditLog()
    log.push({ timestamp: '', action: 'injected', prId: 'X', decision: 'AUTO_APPROVE' })
    expect(approver.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
