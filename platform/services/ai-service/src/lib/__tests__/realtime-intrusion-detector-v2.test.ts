// Plan SC: SVC-AI-ADV-R562-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeIntrusionDetectorV2, type AccessBaseline, type AccessEvent } from '../realtime-intrusion-detector-v2'

describe('RealtimeIntrusionDetectorV2', () => {
  let detector: RealtimeIntrusionDetectorV2

  const baseline: AccessBaseline = {
    serviceId: 'SVC-1',
    allowedIpRanges: ['10.0.', '192.168.'],
    businessHoursStart: 9,
    businessHoursEnd: 18,
    maxRequestsPerMinute: 100,
    maxFailedLoginsPerHour: 5,
  }

  const normalEvent: AccessEvent = {
    eventId: 'EVT-1',
    serviceId: 'SVC-1',
    sourceIp: '10.0.0.1',
    timestamp: '2026-04-13T10:00:00Z',  // 10시 = 업무 시간
    requestsInLastMinute: 20,
    failedLoginsInLastHour: 1,
    userId: 'user@gov.kr',
    action: 'GET /api/data',
  }

  beforeEach(() => {
    detector = new RealtimeIntrusionDetectorV2()
    detector.registerBaseline(baseline)
  })

  it('정상 접근 → 알림 없음', () => {
    const alerts = detector.detectIntrusion(normalEvent)
    expect(alerts).toHaveLength(0)
  })

  it('단시간 다량 요청 (burst≥100) → CRITICAL BURST_REQUEST 알림', () => {
    const alerts = detector.detectIntrusion({ ...normalEvent, eventId: 'EVT-BURST', requestsInLastMinute: 150 })
    expect(alerts.some((a) => a.threatType === 'BURST_REQUEST' && a.threatLevel === 'CRITICAL')).toBe(true)
  })

  it('미허가 IP → HIGH UNAUTHORIZED_IP 알림', () => {
    const alerts = detector.detectIntrusion({ ...normalEvent, eventId: 'EVT-IP', sourceIp: '8.8.8.8' })
    expect(alerts.some((a) => a.threatType === 'UNAUTHORIZED_IP' && a.threatLevel === 'HIGH')).toBe(true)
  })

  it('비업무 시간 접근 → MEDIUM OFF_HOURS_ACCESS 알림', () => {
    const alerts = detector.detectIntrusion({ ...normalEvent, eventId: 'EVT-NIGHT', timestamp: '2026-04-13T02:00:00Z' })
    expect(alerts.some((a) => a.threatType === 'OFF_HOURS_ACCESS' && a.threatLevel === 'MEDIUM')).toBe(true)
  })

  it('무차별 로그인 시도 (5회+) → HIGH BRUTE_FORCE 알림', () => {
    const alerts = detector.detectIntrusion({ ...normalEvent, eventId: 'EVT-BF', failedLoginsInLastHour: 10 })
    expect(alerts.some((a) => a.threatType === 'BRUTE_FORCE' && a.threatLevel === 'HIGH')).toBe(true)
  })

  it('acknowledge: 처리된 알림 → getAlerts에서 제외', () => {
    detector.detectIntrusion({ ...normalEvent, eventId: 'EVT-ACK', sourceIp: '8.8.8.8' })
    const before = detector.getAlerts('SVC-1')
    expect(before.length).toBeGreaterThan(0)
    detector.acknowledge(before[0]!.alertId)
    const after = detector.getAlerts('SVC-1')
    expect(after.length).toBe(before.length - 1)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    detector.detectIntrusion(normalEvent)
    const log1 = detector.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = detector.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
