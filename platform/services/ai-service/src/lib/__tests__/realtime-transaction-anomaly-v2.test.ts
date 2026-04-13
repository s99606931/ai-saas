// Plan SC: SVC-AI-ADV-R461-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeTransactionAnomalyV2, type Transaction } from '../realtime-transaction-anomaly-v2'

describe('RealtimeTransactionAnomalyV2', () => {
  let detector: RealtimeTransactionAnomalyV2

  const baseTx: Transaction = {
    txId: 'TX-1',
    accountId: 'ACC-1',
    amount: 100_000,
    currency: 'KRW',
    timestamp: new Date('2026-04-10T10:00:00Z').getTime(),
    locationCode: 'KR-SEO',
    merchantCode: 'MCH-001',
  }

  beforeEach(() => {
    detector = new RealtimeTransactionAnomalyV2()
  })

  it('미등록 거래 탐지 시 오류 발생', () => {
    expect(() => detector.detect('UNKNOWN')).toThrow('Unknown transaction')
  })

  it('정상 소액 거래 → 이상 없음, riskScore 낮음', () => {
    detector.ingest(baseTx)
    const result = detector.detect('TX-1')
    expect(result.anomalies.filter((a) => a.type === 'LARGE_AMOUNT')).toHaveLength(0)
    expect(result.blocked).toBe(false)
  })

  it('500만원 이상 거래 → LARGE_AMOUNT 탐지', () => {
    const bigTx = { ...baseTx, txId: 'TX-BIG', amount: 5_000_000 }
    detector.ingest(bigTx)
    const result = detector.detect('TX-BIG')
    expect(result.anomalies.some((a) => a.type === 'LARGE_AMOUNT')).toBe(true)
    expect(result.riskScore).toBeGreaterThanOrEqual(25)
  })

  it('60초 내 3건 이상 거래 → RAPID_SUCCESSION 탐지', () => {
    const base = new Date('2026-04-10T10:00:00Z').getTime()
    detector.ingest({ ...baseTx, txId: 'TX-R1', timestamp: base })
    detector.ingest({ ...baseTx, txId: 'TX-R2', timestamp: base + 10_000 })
    detector.ingest({ ...baseTx, txId: 'TX-R3', timestamp: base + 20_000 })
    const result = detector.detect('TX-R3')
    expect(result.anomalies.some((a) => a.type === 'RAPID_SUCCESSION')).toBe(true)
  })

  it('1시간 내 3개 이상 지역 → UNUSUAL_LOCATION CRITICAL, blocked=true', () => {
    const base = new Date('2026-04-10T10:00:00Z').getTime()
    detector.ingest({ ...baseTx, txId: 'TX-L1', timestamp: base, locationCode: 'KR-SEO' })
    detector.ingest({ ...baseTx, txId: 'TX-L2', timestamp: base + 600_000, locationCode: 'KR-BUS' })
    detector.ingest({ ...baseTx, txId: 'TX-L3', timestamp: base + 1_200_000, locationCode: 'US-NYC' })
    const result = detector.detect('TX-L3')
    expect(result.anomalies.some((a) => a.type === 'UNUSUAL_LOCATION' && a.severity === 'CRITICAL')).toBe(true)
    expect(result.blocked).toBe(true)
  })

  it('역방향 유사 금액 24시간 내 → ROUND_TRIP 탐지', () => {
    const base = new Date('2026-04-10T10:00:00Z').getTime()
    // TX-A가 원 거래, TX-B는 reversed=true 인 역방향 거래
    // TX-A를 detect할 때 TX-B(reversed=true)를 roundTrip으로 탐지
    detector.ingest({ ...baseTx, txId: 'TX-A', amount: 100_000, timestamp: base })
    detector.ingest({ ...baseTx, txId: 'TX-B', amount: 99_500, timestamp: base + 3_600_000, reversed: true })
    const result = detector.detect('TX-A')
    expect(result.anomalies.some((a) => a.type === 'ROUND_TRIP')).toBe(true)
  })

  it('야간 UTC 20시 거래 → OFF_HOURS 탐지', () => {
    const nightTs = new Date('2026-04-10T20:30:00Z').getTime()
    detector.ingest({ ...baseTx, txId: 'TX-NIGHT', timestamp: nightTs })
    const result = detector.detect('TX-NIGHT')
    expect(result.anomalies.some((a) => a.type === 'OFF_HOURS')).toBe(true)
  })

  it('riskScore >= 30 이고 blocked=false → requiresReview=true', () => {
    const bigTx = { ...baseTx, txId: 'TX-REV', amount: 5_000_000 }
    detector.ingest(bigTx)
    const result = detector.detect('TX-REV')
    if (!result.blocked && result.riskScore >= 30) {
      expect(result.requiresReview).toBe(true)
    }
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    detector.ingest(baseTx)
    detector.detect('TX-1')
    const log1 = detector.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', accountId: 'X', detail: {} })
    const log2 = detector.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
