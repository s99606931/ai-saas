import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityLogAnomalyDetector, type SecurityLogEntry } from '../security-log-anomaly-detector'

describe('SecurityLogAnomalyDetector', () => {
  let detector: SecurityLogAnomalyDetector

  const baseLog: SecurityLogEntry = {
    logId: 'LOG001',
    timestamp: Date.now(),
    sourceIp: '192.168.1.100',
    userId: 'USR0012345',
    action: 'LOGIN',
    resource: '/api/auth',
    statusCode: 200,
    region: 'KR',
  }

  beforeEach(() => {
    detector = new SecurityLogAnomalyDetector()
  })

  it('정상 로그 → 이상 없음', () => {
    const result = detector.analyze([baseLog])
    expect(result.anomaliesDetected).toBe(0)
    expect(result.riskScore).toBe(0)
  })

  it('인증 실패 5회 이상 → BRUTE_FORCE HIGH', () => {
    const failLogs = Array.from({ length: 6 }, (_, i) => ({
      ...baseLog, logId: `LOG${i}`, statusCode: 401,
    }))
    const result = detector.analyze(failLogs)
    expect(result.anomalies.some((a) => a.anomalyType === 'BRUTE_FORCE')).toBe(true)
  })

  it('인증 실패 10회 이상 → BRUTE_FORCE CRITICAL', () => {
    const failLogs = Array.from({ length: 12 }, (_, i) => ({
      ...baseLog, logId: `LOG${i}`, statusCode: 401,
    }))
    const result = detector.analyze(failLogs)
    const bf = result.anomalies.find((a) => a.anomalyType === 'BRUTE_FORCE')!
    expect(bf.severity).toBe('CRITICAL')
  })

  it('이상 탐지 시 userId 마스킹', () => {
    const failLogs = Array.from({ length: 6 }, (_, i) => ({
      ...baseLog, logId: `LOG${i}`, statusCode: 401,
    }))
    const result = detector.analyze(failLogs)
    const anomaly = result.anomalies[0]!
    expect(anomaly.maskedUserId).not.toBe(anomaly.affectedUserId)
    expect(anomaly.maskedUserId.includes('*')).toBe(true)
  })

  it('IP 마스킹 확인 (x.x.*.*)', () => {
    const failLogs = Array.from({ length: 6 }, (_, i) => ({
      ...baseLog, logId: `LOG${i}`, statusCode: 401,
    }))
    const result = detector.analyze(failLogs)
    const anomaly = result.anomalies[0]!
    expect(anomaly.maskedIp).toMatch(/^\d+\.\d+\.\*\.\*$/)
  })

  it('totalLogs 카운트 정확', () => {
    const logs = [baseLog, { ...baseLog, logId: 'LOG2' }]
    const result = detector.analyze(logs)
    expect(result.totalLogs).toBe(2)
  })

  it('분석 후 감사 로그', () => {
    detector.analyze([baseLog])
    const log = detector.getAuditLog()
    expect(log.some((e) => e.action === 'log.analyze')).toBe(true)
  })
})
