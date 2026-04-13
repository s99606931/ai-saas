// Design Ref: §R423 — Public Transport Optimizer
import { describe, it, expect, beforeEach } from 'vitest'
import { DataMigrationPlannerAi } from '../data-migration-planner-ai'

describe('DataMigrationPlannerAi (Transport Optimizer)', () => {
  let optimizer: DataMigrationPlannerAi

  beforeEach(() => {
    optimizer = new DataMigrationPlannerAi()
  })

  it('N2SF: C등급 차단', () => {
    expect(() => optimizer.optimize({ routeId: 'R001', passengers: 100, capacity: 120, headwayPerHour: 4, dataGrade: 'C' }))
      .toThrow('BLOCKED')
  })

  it('N2SF: S등급 차단', () => {
    expect(() => optimizer.optimize({ routeId: 'R002', passengers: 100, capacity: 120, headwayPerHour: 4, dataGrade: 'S' }))
      .toThrow('BLOCKED')
  })

  it('INCREASE: loadRatio > 0.85', () => {
    const result = optimizer.optimize({ routeId: 'R003', passengers: 90, capacity: 100, headwayPerHour: 6 })
    expect(result.action).toBe('INCREASE')
    expect(result.loadRatio).toBe(0.9)
  })

  it('DECREASE: loadRatio < 0.3', () => {
    const result = optimizer.optimize({ routeId: 'R004', passengers: 20, capacity: 100, headwayPerHour: 4 })
    expect(result.action).toBe('DECREASE')
  })

  it('MAINTAIN: 0.3 ≤ loadRatio ≤ 0.85', () => {
    const result = optimizer.optimize({ routeId: 'R005', passengers: 50, capacity: 100, headwayPerHour: 3 })
    expect(result.action).toBe('MAINTAIN')
  })

  it('estimatedWaitMin: 60 / headwayPerHour', () => {
    const result = optimizer.optimize({ routeId: 'R006', passengers: 50, capacity: 100, headwayPerHour: 4 })
    expect(result.estimatedWaitMin).toBe(15)
  })

  it('감사 로그에 route.optimize 기록', () => {
    optimizer.optimize({ routeId: 'R007', passengers: 50, capacity: 100, headwayPerHour: 3 })
    const logs = optimizer.getAuditLog()
    expect(logs.some((l) => l.action === 'route.optimize')).toBe(true)
  })
})
