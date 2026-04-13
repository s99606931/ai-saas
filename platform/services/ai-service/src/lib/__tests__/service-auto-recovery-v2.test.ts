// Plan SC: SVC-AI-ADV-R378
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceAutoRecoveryV2 } from '../service-auto-recovery-v2'

describe('ServiceAutoRecoveryV2', () => {
  let recovery: ServiceAutoRecoveryV2

  beforeEach(() => {
    recovery = new ServiceAutoRecoveryV2()
  })

  it('registerService — 감사 로그에 service.register 기록', () => {
    recovery.registerService('svc-1', 'API Gateway', ['restart', 'scale'])
    const log = recovery.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('service.register')
  })

  it('recordIncident — incident 반환 및 감사 로그 기록', () => {
    recovery.registerService('svc-1', 'API Gateway', ['restart'])
    const incident = recovery.recordIncident('svc-1', 'timeout', 'high')
    expect(incident.serviceId).toBe('svc-1')
    expect(incident.incidentType).toBe('timeout')
    expect(incident.id).toBeTruthy()
  })

  it('getRecoverySuccessRate — 성공률 계산', () => {
    recovery.registerService('svc-1', 'API Gateway', ['restart'])
    const inc1 = recovery.recordIncident('svc-1', 'timeout', 'high')
    const inc2 = recovery.recordIncident('svc-1', 'crash', 'critical')
    recovery.recordRecovery(inc1.id, 'restart', true)
    recovery.recordRecovery(inc2.id, 'restart', false)
    const rate = recovery.getRecoverySuccessRate('svc-1')
    // 1/2 * 100 = 50
    expect(rate).toBe(50)
  })

  it('getRecoverySuccessRate — 복구 이력 없을 때 0', () => {
    recovery.registerService('svc-1', 'API Gateway', ['restart'])
    expect(recovery.getRecoverySuccessRate('svc-1')).toBe(0)
  })

  it('recordIncident — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    recovery.registerService('svc-1', 'API Gateway', ['restart'])
    expect(() => recovery.recordIncident('svc-1', 'timeout', 'high', 'C')).toThrow('BLOCKED')
  })

  it('recordIncident — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    recovery.registerService('svc-1', 'API Gateway', ['restart'])
    expect(() => recovery.recordIncident('svc-1', 'timeout', 'high', 'S')).toThrow('N2SF N-05')
  })

  it('recordRecovery — 없는 incidentId 에러', () => {
    expect(() => recovery.recordRecovery('nonexistent', 'restart', true)).toThrow('incidentId 없음')
  })

  it('getRecoverySuccessRate — 다른 서비스 인시던트 영향 없음', () => {
    recovery.registerService('svc-1', 'API Gateway', ['restart'])
    recovery.registerService('svc-2', 'DB', ['failover'])
    const inc = recovery.recordIncident('svc-2', 'crash', 'critical')
    recovery.recordRecovery(inc.id, 'failover', true)
    // svc-1은 복구 이력 없음
    expect(recovery.getRecoverySuccessRate('svc-1')).toBe(0)
  })
})
