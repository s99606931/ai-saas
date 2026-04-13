// Design Ref: §R419 — AI기반 서비스 복잡도 자동 감소
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceComplexityReducerAi } from '../service-complexity-reducer-ai'

describe('ServiceComplexityReducerAi', () => {
  let reducer: ServiceComplexityReducerAi

  beforeEach(() => {
    reducer = new ServiceComplexityReducerAi()
  })

  it('SIMPLE: 낮은 복잡도 지수', () => {
    reducer.registerService({ serviceId: 'svc-1', serviceName: '단순 서비스', dependencyCount: 1, apiCount: 2, linesOfCode: 200, hasCircularDeps: false })
    // score = 1*3 + 2*2 + 2 = 9 → SIMPLE
    const report = reducer.analyze()
    expect(report.analyses[0]?.complexityLevel).toBe('SIMPLE')
  })

  it('OVERLY_COMPLEX: 높은 의존성+API → 분리 권고', () => {
    reducer.registerService({ serviceId: 'svc-2', serviceName: '복잡 서비스', dependencyCount: 8, apiCount: 5, linesOfCode: 1000, hasCircularDeps: false })
    // score = 8*3 + 5*2 + 10 = 24+10+10 = 44 → wait: 8*3=24, 5*2=10, 1000/100=10, total=44 → OVERLY_COMPLEX
    const report = reducer.analyze()
    const analysis = report.analyses[0]
    expect(analysis?.complexityLevel).toBe('OVERLY_COMPLEX')
    expect(analysis?.splitRecommended).toBe(true)
  })

  it('순환 의존성 +15점 패널티', () => {
    reducer.registerService({ serviceId: 'svc-3', serviceName: '순환 서비스', dependencyCount: 5, apiCount: 4, linesOfCode: 500, hasCircularDeps: true })
    // score = 5*3+4*2+5 = 15+8+5 = 28 + 15(circular) = 43 → OVERLY_COMPLEX
    const report = reducer.analyze()
    expect(report.analyses[0]?.complexityLevel).toBe('OVERLY_COMPLEX')
    expect(report.analyses[0]?.actions.some((a) => a.includes('순환'))).toBe(true)
  })

  it('의존성 ≥ 10 → 감소 권고', () => {
    reducer.registerService({ serviceId: 'svc-4', serviceName: '의존성 과다', dependencyCount: 12, apiCount: 2, linesOfCode: 300, hasCircularDeps: false })
    const report = reducer.analyze()
    expect(report.analyses[0]?.actions.some((a) => a.includes('의존성'))).toBe(true)
  })

  it('overlyComplexCount 카운트', () => {
    reducer.registerService({ serviceId: 'svc-5', serviceName: 'C1', dependencyCount: 10, apiCount: 5, linesOfCode: 2000, hasCircularDeps: false })
    reducer.registerService({ serviceId: 'svc-6', serviceName: 'C2', dependencyCount: 1, apiCount: 1, linesOfCode: 100, hasCircularDeps: false })
    const report = reducer.analyze()
    expect(report.overlyComplexCount).toBeGreaterThanOrEqual(1)
  })

  it('감사 로그에 complexity.analyze 기록', () => {
    reducer.registerService({ serviceId: 'svc-7', serviceName: 'LOG', dependencyCount: 2, apiCount: 2, linesOfCode: 100, hasCircularDeps: false })
    reducer.analyze()
    const logs = reducer.getAuditLog()
    expect(logs.some((l) => l.action === 'complexity.analyze')).toBe(true)
  })
})
