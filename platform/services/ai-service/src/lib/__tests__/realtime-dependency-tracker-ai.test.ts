// Plan SC: SVC-AI-ADV-R433-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeDependencyTrackerAI } from '../realtime-dependency-tracker-ai'

describe('RealtimeDependencyTrackerAI', () => {
  let tracker: RealtimeDependencyTrackerAI

  beforeEach(() => {
    tracker = new RealtimeDependencyTrackerAI()
    tracker.registerNode({ serviceId: 'SVC-A', name: 'AI 서비스', critical: true })
    tracker.registerNode({ serviceId: 'SVC-B', name: '인증 서비스', critical: false })
    tracker.registerNode({ serviceId: 'SVC-C', name: 'DB 서비스', critical: true })
  })

  it('미등록 서비스 링크 추가 시 오류 발생', () => {
    expect(() => tracker.addLink({ fromServiceId: 'SVC-A', toServiceId: 'UNKNOWN', weight: 5 })).toThrow('Unknown service')
  })

  it('건강 상태 없는 서비스 → UNKNOWN', () => {
    expect(tracker.getCurrentStatus('SVC-A')).toBe('UNKNOWN')
  })

  it('건강 업데이트 후 상태 반영', () => {
    tracker.updateHealth({ serviceId: 'SVC-A', status: 'HEALTHY', timestamp: Date.now() })
    expect(tracker.getCurrentStatus('SVC-A')).toBe('HEALTHY')
  })

  it('정상 서비스 → 알림 없음', () => {
    tracker.updateHealth({ serviceId: 'SVC-A', status: 'HEALTHY', timestamp: Date.now() })
    tracker.updateHealth({ serviceId: 'SVC-B', status: 'HEALTHY', timestamp: Date.now() })
    const alerts = tracker.getAlerts()
    expect(alerts).toHaveLength(0)
  })

  it('크리티컬 서비스 DOWN → CRITICAL 알림', () => {
    tracker.updateHealth({ serviceId: 'SVC-A', status: 'DOWN', timestamp: Date.now() })
    const alerts = tracker.getAlerts()
    const criticalAlert = alerts.find((a) => a.affectedServiceId === 'SVC-A')
    expect(criticalAlert).toBeDefined()
    expect(criticalAlert?.alertLevel).toBe('CRITICAL')
  })

  it('비크리티컬 서비스 DOWN → HIGH 알림', () => {
    tracker.updateHealth({ serviceId: 'SVC-B', status: 'DOWN', timestamp: Date.now() })
    const alerts = tracker.getAlerts()
    const alert = alerts.find((a) => a.affectedServiceId === 'SVC-B')
    expect(alert?.alertLevel).toBe('HIGH')
  })

  it('DEGRADED 크리티컬 서비스 → HIGH 알림', () => {
    tracker.updateHealth({ serviceId: 'SVC-C', status: 'DEGRADED', timestamp: Date.now() })
    const alerts = tracker.getAlerts()
    const alert = alerts.find((a) => a.affectedServiceId === 'SVC-C')
    expect(alert?.alertLevel).toBe('HIGH')
  })

  it('의존 서비스 영향 목록 포함', () => {
    tracker.addLink({ fromServiceId: 'SVC-A', toServiceId: 'SVC-C', weight: 9 })
    tracker.updateHealth({ serviceId: 'SVC-C', status: 'DOWN', timestamp: Date.now() })
    const alerts = tracker.getAlerts()
    const alert = alerts.find((a) => a.affectedServiceId === 'SVC-C')
    expect(alert?.impactedServices).toContain('SVC-A')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    tracker.updateHealth({ serviceId: 'SVC-A', status: 'HEALTHY', timestamp: Date.now() })
    tracker.getAlerts()
    const log1 = tracker.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = tracker.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
