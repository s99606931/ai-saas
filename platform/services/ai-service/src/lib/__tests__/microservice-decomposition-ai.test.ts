import { describe, it, expect, beforeEach } from 'vitest'
import { MicroserviceDecompositionAi, type ServiceComponent } from '../microservice-decomposition-ai'

describe('MicroserviceDecompositionAi', () => {
  let ai: MicroserviceDecompositionAi

  const simpleComponent: ServiceComponent = {
    componentId: 'C001',
    name: '민원 처리 서비스',
    domain: 'complaint',
    linesOfCode: 500,
    dependencies: [],
  }

  beforeEach(() => {
    ai = new MicroserviceDecompositionAi()
    ai.registerComponent(simpleComponent)
  })

  it('컴포넌트 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'component.register')).toBe(true)
  })

  it('낮은 결합도 → NO_CHANGE', () => {
    const result = ai.analyze('C001')
    expect(result.strategy).toBe('NO_CHANGE')
    expect(result.couplingLevel).toBe('LOOSE')
  })

  it('높은 결합도 → BY_DOMAIN 분할', () => {
    // 6개 의존성 → TIGHT
    const heavy: ServiceComponent = {
      componentId: 'C002', name: '통합 서비스', domain: 'all',
      linesOfCode: 3000, dependencies: ['A', 'B', 'C', 'D', 'E', 'F'],
    }
    ai.registerComponent(heavy)
    const result = ai.analyze('C002')
    expect(result.strategy).toBe('BY_DOMAIN')
    expect(result.suggestedServices.length).toBeGreaterThan(0)
  })

  it('중간 결합도 + 대용량 → BY_SCALABILITY', () => {
    const mid: ServiceComponent = {
      componentId: 'C003', name: '데이터 서비스', domain: 'data',
      linesOfCode: 1500, dependencies: ['X', 'Y', 'Z'],
    }
    ai.registerComponent(mid)
    const result = ai.analyze('C003')
    expect(result.strategy).toBe('BY_SCALABILITY')
  })

  it('미등록 컴포넌트 에러', () => {
    expect(() => ai.analyze('UNKNOWN')).toThrow()
  })

  it('복잡도 점수 반환', () => {
    const result = ai.analyze('C001')
    expect(result.complexityScore).toBeGreaterThanOrEqual(0)
    expect(result.complexityScore).toBeLessThanOrEqual(100)
  })

  it('분석 후 감사 로그', () => {
    ai.analyze('C001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'component.analyze')).toBe(true)
  })
})
