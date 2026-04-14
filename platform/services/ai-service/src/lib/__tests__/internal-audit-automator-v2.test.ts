// Plan SC: SVC-AI-ADV-R528-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { InternalAuditAutomatorV2, type AuditControl } from '../internal-audit-automator-v2'

describe('InternalAuditAutomatorV2', () => {
  let automator: InternalAuditAutomatorV2

  const effectiveControl: AuditControl = {
    controlId: 'CTRL-1',
    domain: 'IT_SECURITY',
    name: '접근 통제',
    description: '권한 없는 접근 방지',
    status: 'EFFECTIVE',
    lastTestedDaysAgo: 30,
    automationLevel: 80,
    evidenceCount: 5,
  }

  beforeEach(() => {
    automator = new InternalAuditAutomatorV2()
  })

  it('통제 없을 때 감사 실행 → findings=0, overallRiskRating=LOW', () => {
    const report = automator.runAudit('IT_SECURITY')
    expect(report.findings).toHaveLength(0)
    expect(report.overallRiskRating).toBe('LOW')
  })

  it('EFFECTIVE 통제만 있을 때 → findings=0', () => {
    automator.registerControl(effectiveControl)
    const report = automator.runAudit('IT_SECURITY')
    expect(report.findings.filter((f) => f.riskRating === 'CRITICAL' || f.riskRating === 'HIGH')).toHaveLength(0)
  })

  it('INEFFECTIVE 통제 → HIGH finding 생성', () => {
    automator.registerControl({ ...effectiveControl, controlId: 'CTRL-INEFF', status: 'INEFFECTIVE', lastTestedDaysAgo: 60 })
    const report = automator.runAudit('IT_SECURITY')
    expect(report.findings.some((f) => f.controlId === 'CTRL-INEFF' && f.riskRating === 'HIGH')).toBe(true)
  })

  it('INEFFECTIVE + 365일 이상 미테스트 → CRITICAL finding', () => {
    automator.registerControl({ ...effectiveControl, controlId: 'CTRL-CRIT', status: 'INEFFECTIVE', lastTestedDaysAgo: 400 })
    const report = automator.runAudit('IT_SECURITY')
    expect(report.findings.some((f) => f.controlId === 'CTRL-CRIT' && f.riskRating === 'CRITICAL')).toBe(true)
    expect(report.overallRiskRating).toBe('CRITICAL')
  })

  it('EFFECTIVE + 365일 이상 미테스트 → MEDIUM finding (UNTEST)', () => {
    automator.registerControl({ ...effectiveControl, controlId: 'CTRL-OLD', lastTestedDaysAgo: 400 })
    const report = automator.runAudit('IT_SECURITY')
    expect(report.findings.some((f) => f.controlId === 'CTRL-OLD' && f.riskRating === 'MEDIUM')).toBe(true)
  })

  it('evidenceCount=0 → LOW finding (NOEVID)', () => {
    automator.registerControl({ ...effectiveControl, controlId: 'CTRL-NOEV', evidenceCount: 0 })
    const report = automator.runAudit('IT_SECURITY')
    expect(report.findings.some((f) => f.controlId === 'CTRL-NOEV' && f.riskRating === 'LOW')).toBe(true)
  })

  it('자동화 커버리지 50% 미만 → 권고 포함', () => {
    automator.registerControl({ ...effectiveControl, controlId: 'CTRL-LOW-AUTO', automationLevel: 20 })
    const report = automator.runAudit('IT_SECURITY')
    expect(report.recommendations.some((r) => r.includes('자동화'))).toBe(true)
  })

  it('다른 도메인 통제는 감사 결과에서 제외', () => {
    automator.registerControl(effectiveControl)
    automator.registerControl({ ...effectiveControl, controlId: 'CTRL-FIN', domain: 'FINANCIAL' })
    const report = automator.runAudit('IT_SECURITY')
    expect(report.totalControls).toBe(1)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    automator.registerControl(effectiveControl)
    automator.runAudit('IT_SECURITY')
    const log1 = automator.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', controlId: 'X', detail: {} })
    const log2 = automator.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
