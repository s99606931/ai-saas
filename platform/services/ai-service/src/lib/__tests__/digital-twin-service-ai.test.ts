// Plan SC: SVC-AI-ADV-R589-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { DigitalTwinServiceAI, type PhysicalAsset, type AssetState } from '../digital-twin-service-ai'

describe('DigitalTwinServiceAI', () => {
  let twin: DigitalTwinServiceAI

  const asset: PhysicalAsset = {
    assetId: 'AST-1', name: '서버 랙 A',
    assetType: 'SERVER', location: '데이터센터 1층',
    installedAt: '2024-01-01',
    normalOperatingRange: { temperatureMin: 18, temperatureMax: 27, loadMin: 10, loadMax: 80 },
  }

  const normalState: AssetState = {
    assetId: 'AST-1', timestamp: new Date().toISOString(),
    temperatureCelsius: 22, loadPct: 60,
    powerConsumptionKw: 5, operationalStatus: 'NORMAL', alerts: [],
  }

  beforeEach(() => {
    twin = new DigitalTwinServiceAI()
  })

  it('미등록 자산 상태 동기화 시 오류 발생', () => {
    expect(() => twin.syncState('UNKNOWN', normalState)).toThrow('Unknown asset')
  })

  it('미등록 자산 시뮬레이션 시 오류 발생', () => {
    expect(() => twin.simulate('UNKNOWN', 'OVERLOAD')).toThrow('Unknown asset')
  })

  it('정상 상태 동기화 → 알림 없음', () => {
    twin.registerPhysicalAsset(asset)
    twin.syncState('AST-1', normalState)
    const state = twin.getDigitalState('AST-1')
    expect(state.alerts).toHaveLength(0)
    expect(state.operationalStatus).toBe('NORMAL')
  })

  it('온도 초과 → 알림 생성', () => {
    twin.registerPhysicalAsset(asset)
    twin.syncState('AST-1', { ...normalState, temperatureCelsius: 35 })
    const state = twin.getDigitalState('AST-1')
    expect(state.alerts.some((a) => a.includes('온도'))).toBe(true)
  })

  it('OVERLOAD 시뮬레이션 → CRITICAL 예측', () => {
    twin.registerPhysicalAsset(asset)
    twin.syncState('AST-1', { ...normalState, loadPct: 60 })
    const result = twin.simulate('AST-1', 'OVERLOAD')
    expect(result.predictedStatus).toBe('CRITICAL')
    expect(result.riskFactors.length).toBeGreaterThan(0)
  })

  it('FAILURE 시뮬레이션 → OFFLINE 예측', () => {
    twin.registerPhysicalAsset(asset)
    twin.syncState('AST-1', normalState)
    const result = twin.simulate('AST-1', 'FAILURE')
    expect(result.predictedStatus).toBe('OFFLINE')
    expect(result.mitigationActions.length).toBeGreaterThan(0)
  })

  it('RECOVERY 시뮬레이션 → NORMAL 예측', () => {
    twin.registerPhysicalAsset(asset)
    twin.syncState('AST-1', normalState)
    const result = twin.simulate('AST-1', 'RECOVERY')
    expect(result.predictedStatus).toBe('NORMAL')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    twin.registerPhysicalAsset(asset)
    twin.syncState('AST-1', normalState)
    twin.simulate('AST-1', 'OVERLOAD')
    const log1 = twin.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', assetId: 'X', detail: {} })
    const log2 = twin.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
