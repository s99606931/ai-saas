import { describe, it, expect, beforeEach } from 'vitest'
import { DeploymentRiskAssessorAI } from '../deployment-risk-assessor-ai'

describe('DeploymentRiskAssessorAI', () => {
  let assessor: DeploymentRiskAssessorAI

  beforeEach(() => {
    assessor = new DeploymentRiskAssessorAI()
  })

  it('안전한 배포 — LOW 리스크', () => {
    const result = assessor.assess({ deployId: 'D-1', serviceName: 'api', version: '1.0.1', targetEnvironment: 'DEV', changedFiles: 3, hasDatabaseMigration: false, hasConfigChange: false, rollbackPlanReady: true })
    expect(result.riskLevel).toBe('LOW')
    expect(result.approvalRequired).toBe(false)
  })

  it('DB 마이그레이션 포함 — 리스크 상승', () => {
    const result = assessor.assess({ deployId: 'D-2', serviceName: 'api', version: '2.0.0', targetEnvironment: 'STAGING', changedFiles: 5, hasDatabaseMigration: true, hasConfigChange: false, rollbackPlanReady: true })
    expect(result.riskFactors.some((f) => f.includes('데이터베이스'))).toBe(true)
    expect(result.riskScore).toBeGreaterThan(0)
  })

  it('프로덕션 + DB 마이그레이션 + 롤백 미비 — CRITICAL', () => {
    const result = assessor.assess({ deployId: 'D-3', serviceName: 'api', version: '3.0.0', targetEnvironment: 'PRODUCTION', changedFiles: 60, hasDatabaseMigration: true, hasConfigChange: true, rollbackPlanReady: false })
    expect(result.riskLevel).toBe('CRITICAL')
    expect(result.approvalRequired).toBe(true)
  })

  it('롤백 미비 — 리스크 요인 포함', () => {
    const result = assessor.assess({ deployId: 'D-4', serviceName: 'api', version: '1.0.2', targetEnvironment: 'PRODUCTION', changedFiles: 5, hasDatabaseMigration: false, hasConfigChange: false, rollbackPlanReady: false })
    expect(result.riskFactors.some((f) => f.includes('롤백'))).toBe(true)
  })

  it('대규모 변경 — 리스크 요인 포함', () => {
    const result = assessor.assess({ deployId: 'D-5', serviceName: 'api', version: '2.0.0', targetEnvironment: 'STAGING', changedFiles: 55, hasDatabaseMigration: false, hasConfigChange: false, rollbackPlanReady: true })
    expect(result.riskFactors.some((f) => f.includes('대규모'))).toBe(true)
  })

  it('감사 로그 복사본 반환', () => {
    assessor.assess({ deployId: 'D-6', serviceName: 'api', version: '1.0.0', targetEnvironment: 'DEV', changedFiles: 2, hasDatabaseMigration: false, hasConfigChange: false, rollbackPlanReady: true })
    const log = assessor.getAuditLog()
    log.push({ timestamp: '', action: 'injected', deployId: 'X', detail: {} })
    expect(assessor.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
