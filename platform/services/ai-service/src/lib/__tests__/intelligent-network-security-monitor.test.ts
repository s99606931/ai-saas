// Plan SC: SVC-AI-ADV-R380
import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentNetworkSecurityMonitor } from '../intelligent-network-security-monitor'

describe('IntelligentNetworkSecurityMonitor', () => {
  let monitor: IntelligentNetworkSecurityMonitor

  beforeEach(() => {
    monitor = new IntelligentNetworkSecurityMonitor()
  })

  it('registerSegment — 감사 로그에 segment.register 기록', () => {
    monitor.registerSegment('seg-1', 'DMZ', 100)
    const log = monitor.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('segment.register')
  })

  it('recordTraffic — 임계치 이하 시 null 반환', () => {
    monitor.registerSegment('seg-1', 'DMZ', 100)
    const result = monitor.recordTraffic('seg-1', 80, '10.0.0.1')
    expect(result).toBeNull()
  })

  it('recordTraffic — 임계치 초과 시 warning ThreatEvent 생성', () => {
    monitor.registerSegment('seg-1', 'DMZ', 100)
    const threat = monitor.recordTraffic('seg-1', 150, '192.168.1.1')
    expect(threat).not.toBeNull()
    expect(threat!.level).toBe('warning')
    expect(threat!.resolved).toBe(false)
  })

  it('recordTraffic — 임계치 2배 초과 시 critical ThreatEvent 생성', () => {
    monitor.registerSegment('seg-1', 'DMZ', 100)
    const threat = monitor.recordTraffic('seg-1', 250, '192.168.1.1')
    expect(threat!.level).toBe('critical')
  })

  it('getActiveThreats — resolved=false 위협만 반환', () => {
    monitor.registerSegment('seg-1', 'DMZ', 100)
    const t1 = monitor.recordTraffic('seg-1', 150, '1.1.1.1')!
    monitor.recordTraffic('seg-1', 200, '2.2.2.2')
    monitor.resolveThreat(t1.id)
    const active = monitor.getActiveThreats()
    expect(active).toHaveLength(1)
    expect(active[0]!.resolved).toBe(false)
  })

  it('recordTraffic — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    monitor.registerSegment('seg-1', 'DMZ', 100)
    expect(() => monitor.recordTraffic('seg-1', 150, '1.1.1.1', 'C')).toThrow('BLOCKED')
  })

  it('recordTraffic — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    monitor.registerSegment('seg-1', 'DMZ', 100)
    expect(() => monitor.recordTraffic('seg-1', 150, '1.1.1.1', 'S')).toThrow('N2SF N-05')
  })

  it('resolveThreat — 없는 threatId 에러', () => {
    expect(() => monitor.resolveThreat('nonexistent')).toThrow('threatId 없음')
  })
})
