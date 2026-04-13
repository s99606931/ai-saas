// Plan SC: SVC-AI-ADV-R397-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeApiThreatDetector, type ApiRequest } from '../realtime-api-threat-detector'

describe('RealtimeApiThreatDetector', () => {
  let detector: RealtimeApiThreatDetector

  beforeEach(() => {
    detector = new RealtimeApiThreatDetector()
  })

  const cleanRequest: ApiRequest = {
    requestId: 'R1',
    clientIp: '192.168.1.1',
    endpoint: '/api/users',
    method: 'GET',
    payload: '{}',
    statusCode: 200,
    timestamp: Date.now(),
    clientId: 'CLIENT-1',
  }

  it('정상 요청 → 위협 없음', () => {
    const result = detector.detect(cleanRequest)
    expect(result.threats).toHaveLength(0)
    expect(result.blocked).toBe(false)
  })

  it('SQL 인젝션 탐지', () => {
    const result = detector.detect({ ...cleanRequest, requestId: 'R-SQL', payload: "' OR 1=1 -- SELECT * FROM users" })
    const sqlThreat = result.threats.find((t) => t.type === 'SQL_INJECTION')
    expect(sqlThreat).toBeDefined()
    expect(sqlThreat?.severity).toBe('CRITICAL')
  })

  it('XSS 탐지', () => {
    const result = detector.detect({ ...cleanRequest, requestId: 'R-XSS', payload: '<script>alert(1)</script>' })
    const xssThreat = result.threats.find((t) => t.type === 'XSS')
    expect(xssThreat).toBeDefined()
    expect(xssThreat?.severity).toBe('HIGH')
  })

  it('경로 순회 탐지', () => {
    const result = detector.detect({ ...cleanRequest, requestId: 'R-PATH', endpoint: '/api/../../../etc/passwd' })
    const pathThreat = result.threats.find((t) => t.type === 'PATH_TRAVERSAL')
    expect(pathThreat).toBeDefined()
  })

  it('무차별 대입 탐지: 60초 내 5회 이상 401', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      detector.detect({ ...cleanRequest, requestId: `BF-${i}`, statusCode: 401, timestamp: now + i * 1000 })
    }
    const result = detector.detect({ ...cleanRequest, requestId: 'BF-5', statusCode: 401, timestamp: now + 6000 })
    const bruteForceThreat = result.threats.find((t) => t.type === 'BRUTE_FORCE')
    expect(bruteForceThreat).toBeDefined()
  })

  it('속도 남용 탐지: 60초 내 100회 이상 요청', () => {
    const now = Date.now()
    for (let i = 0; i < 100; i++) {
      detector.detect({ ...cleanRequest, requestId: `RATE-${i}`, timestamp: now + i * 100 })
    }
    const result = detector.detect({ ...cleanRequest, requestId: 'RATE-100', timestamp: now + 10100 })
    const rateThreat = result.threats.find((t) => t.type === 'RATE_ABUSE')
    expect(rateThreat).toBeDefined()
  })

  it('CRITICAL 위협 시 blocked=true', () => {
    const result = detector.detect({ ...cleanRequest, requestId: 'R-BLOCK', payload: "'; DROP TABLE users --" })
    expect(result.blocked).toBe(true)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    detector.detect(cleanRequest)
    const log1 = detector.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', clientId: 'X', detail: {} })
    const log2 = detector.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
