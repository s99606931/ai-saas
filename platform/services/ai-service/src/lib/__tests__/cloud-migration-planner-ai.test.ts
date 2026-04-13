import { describe, it, expect, beforeEach } from 'vitest'
import { CloudMigrationPlannerAi, type WorkloadProfile } from '../cloud-migration-planner-ai'

describe('CloudMigrationPlannerAi', () => {
  let planner: CloudMigrationPlannerAi

  const workload: WorkloadProfile = {
    workloadId: 'WL001',
    name: '민원 API 서버',
    currentEnvironment: 'ON_PREMISE',
    cpuCores: 4,
    memoryGb: 8,
    storageGb: 100,
    monthlyTrafficGb: 500,
    dataGrade: 'O',
    dependencies: [],
  }

  beforeEach(() => {
    planner = new CloudMigrationPlannerAi()
    planner.registerWorkload(workload)
  })

  it('워크로드 등록 감사 로그', () => {
    const log = planner.getAuditLog()
    expect(log.some((e) => e.action === 'workload.register')).toBe(true)
  })

  it('O등급 소규모 ON_PREMISE → REHOST, K3S_ON_PREMISE', () => {
    const plan = planner.plan('WL001')
    expect(plan.recommendedStrategy).toBe('REHOST')
    expect(plan.targetEnvironment).toBe('K3S_ON_PREMISE')
    expect(plan.riskLevel).toBe('LOW')
  })

  it('C등급 → 온프레미스 전용, blocker 생성', () => {
    planner.registerWorkload({ ...workload, workloadId: 'WL002', dataGrade: 'C' })
    const plan = planner.plan('WL002')
    expect(plan.targetEnvironment).toBe('K3S_ON_PREMISE')
    expect(plan.blockers.some((b) => b.includes('C등급'))).toBe(true)
    expect(plan.riskLevel).toBe('HIGH')
  })

  it('LEGACY 환경 → REFACTOR 전략', () => {
    planner.registerWorkload({ ...workload, workloadId: 'WL003', currentEnvironment: 'LEGACY', dataGrade: 'O' })
    const plan = planner.plan('WL003')
    expect(plan.recommendedStrategy).toBe('REFACTOR')
  })

  it('대형 워크로드 → REPLATFORM, HYBRID', () => {
    planner.registerWorkload({ ...workload, workloadId: 'WL004', cpuCores: 16, memoryGb: 64, dataGrade: 'O' })
    const plan = planner.plan('WL004')
    expect(plan.recommendedStrategy).toBe('REPLATFORM')
    expect(plan.targetEnvironment).toBe('HYBRID')
  })

  it('의존성 있으면 effort 증가 + 권고사항', () => {
    planner.registerWorkload({ ...workload, workloadId: 'WL005', dependencies: ['SVC-A', 'SVC-B'] })
    const plan = planner.plan('WL005')
    expect(plan.estimatedEffortDays).toBeGreaterThan(7)
    expect(plan.recommendations.some((r) => r.includes('의존성'))).toBe(true)
  })

  it('미등록 워크로드 에러', () => {
    expect(() => planner.plan('UNKNOWN')).toThrow()
  })

  it('계획 후 감사 로그', () => {
    planner.plan('WL001')
    const log = planner.getAuditLog()
    expect(log.some((e) => e.action === 'migration.plan')).toBe(true)
  })
})
