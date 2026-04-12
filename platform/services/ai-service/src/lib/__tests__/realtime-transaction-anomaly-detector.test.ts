import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeTransactionAnomalyDetector, type TransactionProfile, type Transaction } from '../realtime-transaction-anomaly-detector'

describe('RealtimeTransactionAnomalyDetector', () => {
  let detector: RealtimeTransactionAnomalyDetector

  const profile: TransactionProfile = {
    accountId: 'ACC001',
    typicalMaxAmount: 1_000_000,
    typicalHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
    typicalLocation: '서울',
  }

  const makeTx = (id: string, amount: number, hour: number, location = '서울'): Transaction => ({
    transactionId: id,
    accountId: 'ACC001',
    type: 'PAYMENT',
    amount,
    timestamp: new Date().setHours(hour, 0, 0, 0),
    location,
  })

  beforeEach(() => {
    detector = new RealtimeTransactionAnomalyDetector()
    detector.registerProfile(profile)
  })

  it('프로파일 등록 감사 로그', () => {
    const log = detector.getAuditLog()
    expect(log.some((e) => e.action === 'profile.register')).toBe(true)
  })

  it('정상 거래 → anomaly null', () => {
    const result = detector.detect(makeTx('T001', 500_000, 10))
    expect(result).toBeNull()
  })

  it('대규모 금액 → LARGE_AMOUNT CRITICAL 차단', () => {
    const result = detector.detect(makeTx('T002', 4_000_000, 10))
    expect(result).not.toBeNull()
    expect(result!.anomalyType).toBe('LARGE_AMOUNT')
    expect(result!.severity).toBe('CRITICAL')
    expect(result!.blocked).toBe(true)
  })

  it('비정상 시간대 → UNUSUAL_HOUR MEDIUM', () => {
    const result = detector.detect(makeTx('T003', 500_000, 3))  // 새벽 3시
    expect(result).not.toBeNull()
    expect(result!.anomalyType).toBe('UNUSUAL_HOUR')
    expect(result!.severity).toBe('MEDIUM')
  })

  it('이상 위치 + 큰 금액 → FOREIGN_LOCATION HIGH', () => {
    const result = detector.detect(makeTx('T004', 600_000, 10, '부산'))
    expect(result).not.toBeNull()
    expect(result!.anomalyType).toBe('FOREIGN_LOCATION')
    expect(result!.severity).toBe('HIGH')
  })

  it('고빈도 거래 → VELOCITY', () => {
    // 업무 시간대(10시)로 고정하여 UNUSUAL_HOUR 탐지 방지
    const baseTime = new Date()
    baseTime.setHours(10, 0, 0, 0)
    const base = baseTime.getTime()
    for (let i = 0; i < 4; i++) {
      detector.detect({ transactionId: `T_V${i}`, accountId: 'ACC001', type: 'PAYMENT', amount: 10_000, timestamp: base + i * 100, location: '서울' })
    }
    // 5번째 → VELOCITY 탐지 (1분 내 5건)
    const result = detector.detect({ transactionId: 'T_V4', accountId: 'ACC001', type: 'PAYMENT', amount: 10_000, timestamp: base + 400, location: '서울' })
    expect(result).not.toBeNull()
    expect(result!.anomalyType).toBe('VELOCITY')
  })

  it('미등록 계정 에러', () => {
    expect(() => detector.detect({ ...makeTx('T999', 100, 10), accountId: 'UNKNOWN' })).toThrow()
  })

  it('이상 거래 목록 계정별 필터', () => {
    detector.detect(makeTx('T005', 5_000_000, 10))
    const anomalies = detector.getAnomalies('ACC001')
    expect(anomalies.every((a) => a.accountId === 'ACC001')).toBe(true)
  })
})
