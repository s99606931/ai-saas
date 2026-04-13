import { describe, it, expect } from 'vitest'
import { DeploymentStrategyOptimizerAI } from '../deployment-strategy-optimizer-ai'

describe('DeploymentStrategyOptimizerAI', () => {
  const optimizer = new DeploymentStrategyOptimizerAI()

  it('HOTFIX + PRODUCTION — BLUE_GREEN 전략', () => {
    const plan = optimizer.optimize({ deploymentId: 'D-1', serviceName: 'auth', environment: 'PRODUCTION', changeType: 'HOTFIX', changeSize: 3, hasRollbackPlan: true, estimatedDowntimeMs: 0, previousFailureRate: 0 })
    expect(plan.recommendedStrategy).toBe('BLUE_GREEN')
  })

  it('SCHEMA_MIGRATION — RECREATE 전략', () => {
    const plan = optimizer.optimize({ deploymentId: 'D-2', serviceName: 'db', environment: 'STAGING', changeType: 'SCHEMA_MIGRATION', changeSize: 5, hasRollbackPlan: true, estimatedDowntimeMs: 0, previousFailureRate: 0 })
    expect(plan.recommendedStrategy).toBe('RECREATE')
    expect(plan.riskLevel).not.toBe('LOW')
  })

  it('롤백 계획 없음 — warning 포함', () => {
    const plan = optimizer.optimize({ deploymentId: 'D-3', serviceName: 'svc', environment: 'DEV', changeType: 'FEATURE', changeSize: 10, hasRollbackPlan: false, estimatedDowntimeMs: 0, previousFailureRate: 0 })
    expect(plan.warnings.some((w) => w.includes('롤백'))).toBe(true)
  })

  it('CRITICAL/HIGH 리스크 — approvalRequired', () => {
    const plan = optimizer.optimize({ deploymentId: 'D-4', serviceName: 'api', environment: 'PRODUCTION', changeType: 'SCHEMA_MIGRATION', changeSize: 60, hasRollbackPlan: false, estimatedDowntimeMs: 5000, previousFailureRate: 0.4 })
    expect(plan.approvalRequired).toBe(true)
    expect(['CRITICAL', 'HIGH']).toContain(plan.riskLevel)
  })

  it('소규모 FEATURE DEV 배포 — LOW 리스크', () => {
    const plan = optimizer.optimize({ deploymentId: 'D-5', serviceName: 'worker', environment: 'DEV', changeType: 'FEATURE', changeSize: 3, hasRollbackPlan: true, estimatedDowntimeMs: 0, previousFailureRate: 0 })
    expect(plan.riskLevel).toBe('LOW')
    expect(plan.approvalRequired).toBe(false)
  })

  it('감사 로그 복사본 반환', () => {
    optimizer.optimize({ deploymentId: 'D-6', serviceName: 'x', environment: 'DEV', changeType: 'CONFIG', changeSize: 1, hasRollbackPlan: true, estimatedDowntimeMs: 0, previousFailureRate: 0 })
    const log = optimizer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', deploymentId: 'X', detail: {} })
    expect(optimizer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
