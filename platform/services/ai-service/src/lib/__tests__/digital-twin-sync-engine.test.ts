import { describe, it, expect, beforeEach } from 'vitest'
import { DigitalTwinSyncEngine, type TwinEntity, type AnomalyRule } from '../digital-twin-sync-engine'

describe('DigitalTwinSyncEngine', () => {
  let engine: DigitalTwinSyncEngine

  const pumpEntity: TwinEntity = {
    entityId: 'PUMP-001',
    type: 'pump',
    initialState: { pressure: 50, temperature: 30, flowRate: 100 },
    grade: 'O',
  }

  const pressureRule: AnomalyRule = {
    entityType: 'pump',
    field: 'pressure',
    min: 20,
    max: 80,
    severity: 'HIGH',
  }

  const tempRule: AnomalyRule = {
    entityType: 'pump',
    field: 'temperature',
    min: 0,
    max: 60,
    severity: 'MEDIUM',
  }

  beforeEach(() => {
    engine = new DigitalTwinSyncEngine()
    engine.registerEntity(pumpEntity)
    engine.registerAnomalyRule(pressureRule)
    engine.registerAnomalyRule(tempRule)
  })

  it('S등급 엔티티 차단', () => {
    expect(() =>
      engine.registerEntity({ ...pumpEntity, entityId: 'PUMP-X', grade: 'S' })
    ).toThrow('BLOCKED')
  })

  it('O등급 아닌 경우 거부', () => {
    expect(() =>
      engine.registerEntity({ ...pumpEntity, entityId: 'PUMP-Y', grade: undefined })
    ).toThrow('O등급만')
  })

  it('초기 등록 → version 1', () => {
    const state = engine.getState('PUMP-001')
    expect(state.version).toBe(1)
    expect(state.state.pressure).toBe(50)
  })

  it('상태 업데이트 → version 증가 + delta', () => {
    const result = engine.updateState('PUMP-001', { pressure: 55, temperature: 35 })
    expect(result.version).toBe(2)
    expect(result.delta.changed.pressure).toEqual({ from: 50, to: 55 })
    expect(result.delta.changed.temperature).toEqual({ from: 30, to: 35 })
  })

  it('정상 범위 → 이상 없음', () => {
    const result = engine.updateState('PUMP-001', { pressure: 60 })
    expect(result.anomalies).toHaveLength(0)
  })

  it('압력 초과 → HIGH 이상 감지', () => {
    const result = engine.updateState('PUMP-001', { pressure: 95 })
    expect(result.anomalies).toHaveLength(1)
    expect(result.anomalies[0]?.severity).toBe('HIGH')
    expect(result.anomalies[0]?.field).toBe('pressure')
  })

  it('온도 부족 → MEDIUM 이상 감지', () => {
    const result = engine.updateState('PUMP-001', { temperature: -5 })
    expect(result.anomalies.some((a) => a.severity === 'MEDIUM')).toBe(true)
  })

  it('버전 이력 조회', () => {
    engine.updateState('PUMP-001', { pressure: 55 })
    engine.updateState('PUMP-001', { pressure: 60 })
    const history = engine.getHistory('PUMP-001')
    expect(history.length).toBe(3)
    expect(history[0]?.version).toBe(1)
    expect(history[2]?.version).toBe(3)
  })

  it('Delta — added/removed/changed 구분', () => {
    const delta = engine.computeDelta(
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 5, d: 4 }
    )
    expect(delta.changed.b).toEqual({ from: 2, to: 5 })
    expect(delta.added.d).toBe(4)
    expect(delta.removed.c).toBe(3)
  })

  it('잘못된 규칙 (min > max) 차단', () => {
    expect(() =>
      engine.registerAnomalyRule({ entityType: 'pump', field: 'x', min: 100, max: 50, severity: 'LOW' })
    ).toThrow('min')
  })

  it('미등록 엔티티 업데이트 → 에러', () => {
    expect(() => engine.updateState('UNKNOWN', { x: 1 })).toThrow('Unknown entity')
  })

  it('감사 로그 — entityId 마스킹', () => {
    engine.updateState('PUMP-001', { pressure: 55 })
    const log = engine.getAuditLog()
    const hasMasked = log.some((e) => e.entityIdMasked.includes('***'))
    expect(hasMasked).toBe(true)
    const hasRaw = log.some((e) => e.entityIdMasked === 'PUMP-001')
    expect(hasRaw).toBe(false)
  })
})
