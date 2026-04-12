import { describe, it, expect, beforeEach } from 'vitest'
import { MultitenantDataMigratorAi, type TenantConfig } from '../multitenant-data-migrator-ai'

describe('MultitenantDataMigratorAi', () => {
  let migrator: MultitenantDataMigratorAi

  const smallTenant: TenantConfig = {
    tenantId: 'T001',
    name: '소형 기관',
    dataSize: 'SMALL',
    isolationLevel: 'SCHEMA',
  }

  const largeTenant: TenantConfig = {
    tenantId: 'T002',
    name: '대형 기관',
    dataSize: 'LARGE',
    isolationLevel: 'DATABASE',
  }

  beforeEach(() => {
    migrator = new MultitenantDataMigratorAi()
    migrator.registerTenant(smallTenant)
    migrator.registerTenant(largeTenant)
  })

  it('테넌트 등록 감사 로그', () => {
    const log = migrator.getAuditLog()
    expect(log.some((e) => e.action === 'tenant.register')).toBe(true)
  })

  it('미등록 테넌트 플랜 생성 에러', () => {
    expect(() => migrator.createPlan('UNKNOWN', 'v1', 'v2', ['SCHEMA', 'DATA'])).toThrow()
  })

  it('소형 테넌트 LOW 위험 플랜', () => {
    const plan = migrator.createPlan('T001', 'v1', 'v2', ['SCHEMA', 'DATA'])
    expect(plan.riskLevel).toBe('LOW')
  })

  it('대형 테넌트 HIGH 위험 플랜', () => {
    const plan = migrator.createPlan('T002', 'v1', 'v2', ['SCHEMA', 'DATA'])
    expect(plan.riskLevel).toBe('HIGH')
  })

  it('소형 테넌트 플랜 실행 성공', () => {
    const plan = migrator.createPlan('T001', 'v1', 'v2', ['SCHEMA', 'DATA'])
    const result = migrator.executePlan(plan.planId)
    expect(result.status).toBe('COMPLETED')
    expect(result.completedSteps.length).toBe(2)
  })

  it('대형 테넌트 플랜 실행 실패 (HIGH 위험)', () => {
    const plan = migrator.createPlan('T002', 'v1', 'v2', ['DATA'])
    const result = migrator.executePlan(plan.planId)
    expect(result.status).toBe('FAILED')
    expect(result.errorMessage).toBeDefined()
  })

  it('예상 시간 계산', () => {
    const plan = migrator.createPlan('T001', 'v1', 'v2', ['SCHEMA', 'DATA', 'INDEX'])
    expect(plan.estimatedMinutes).toBe(15)  // SMALL=5 * 3 steps
  })

  it('플랜 실행 감사 로그', () => {
    const plan = migrator.createPlan('T001', 'v1', 'v2', ['SCHEMA'])
    migrator.executePlan(plan.planId)
    const log = migrator.getAuditLog()
    expect(log.some((e) => e.action === 'plan.execute')).toBe(true)
  })
})
