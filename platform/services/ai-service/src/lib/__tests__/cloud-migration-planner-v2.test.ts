import { describe, it, expect, beforeEach } from 'vitest'
import { CloudMigrationPlannerV2 } from '../cloud-migration-planner-v2'

describe('CloudMigrationPlannerV2', () => {
  let planner: CloudMigrationPlannerV2

  beforeEach(() => {
    planner = new CloudMigrationPlannerV2()
  })

  it('시스템 등록 후 조회 가능', () => {
    const sys = planner.registerSystem('sys-1', '민원처리시스템', 'legacy')
    expect(sys.systemId).toBe('sys-1')
    expect(sys.techStack).toBe('legacy')
  })

  it('복잡도 점수: deps*10 + techScore(legacy=30)', () => {
    planner.registerSystem('sys-1', '민원처리시스템', 'legacy')
    planner.addDependencies('sys-1', 4)
    expect(planner.getComplexityScore('sys-1')).toBe(70)
  })

  it('복잡도 점수 최대 100', () => {
    planner.registerSystem('sys-1', '민원처리시스템', 'legacy')
    planner.addDependencies('sys-1', 10)
    expect(planner.getComplexityScore('sys-1')).toBe(100)
  })

  it('cloud-native: techScore=5', () => {
    planner.registerSystem('sys-1', '클라우드서비스', 'cloud-native')
    planner.addDependencies('sys-1', 1)
    expect(planner.getComplexityScore('sys-1')).toBe(15)
  })

  it('refactor 전략: 70 이상', () => {
    planner.registerSystem('sys-1', '민원처리시스템', 'legacy')
    planner.addDependencies('sys-1', 4)
    expect(planner.getMigrationStrategy('sys-1')).toBe('refactor')
  })

  it('replatform 전략: 40 이상 70 미만', () => {
    planner.registerSystem('sys-1', '민원처리시스템', 'modern')
    planner.addDependencies('sys-1', 3)
    expect(planner.getMigrationStrategy('sys-1')).toBe('replatform')
  })

  it('rehost 전략: 40 미만', () => {
    planner.registerSystem('sys-1', '클라우드서비스', 'cloud-native')
    planner.addDependencies('sys-1', 1)
    expect(planner.getMigrationStrategy('sys-1')).toBe('rehost')
  })

  it('C등급 데이터 전송 차단', () => {
    planner.registerSystem('sys-1', '민원처리시스템', 'legacy')
    expect(() => planner.addDependencies('sys-1', 3, 'C')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    planner.registerSystem('sys-1', '민원처리시스템', 'legacy')
    planner.addDependencies('sys-1', 3)
    const log = planner.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
