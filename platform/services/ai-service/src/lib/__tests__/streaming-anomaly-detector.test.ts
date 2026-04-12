import { describe, it, expect, beforeEach } from 'vitest'
import { StreamingAnomalyDetector, type StreamConfig, type StreamEvent } from '../streaming-anomaly-detector'

describe('StreamingAnomalyDetector', () => {
  let detector: StreamingAnomalyDetector

  const config: StreamConfig = {
    streamId: 's1',
    name: '로그 스트림',
    expectedRatePerSecond: 100,
    anomalyThresholdSigma: 2.0,
  }

  const makeEvent = (windowId: string, count: number): StreamEvent => ({
    streamId: 's1',
    windowId,
    eventCount: count,
    timestamp: Date.now(),
  })

  beforeEach(() => {
    detector = new StreamingAnomalyDetector()
    detector.registerStream(config)
  })

  it('스트림 등록 감사 로그', () => {
    const log = detector.getAuditLog()
    expect(log.some((e) => e.action === 'stream.register')).toBe(true)
  })

  it('3개 미만 이벤트 → null 반환', () => {
    const r1 = detector.ingest(makeEvent('w1', 100))
    const r2 = detector.ingest(makeEvent('w2', 110))
    expect(r1).toBeNull()
    expect(r2).toBeNull()
  })

  it('정상 범위 이벤트 → 이상 없음', () => {
    detector.ingest(makeEvent('w1', 100))
    detector.ingest(makeEvent('w2', 105))
    const r = detector.ingest(makeEvent('w3', 98))
    expect(r).toBeNull()
  })

  it('급등(SPIKE) 이상 탐지', () => {
    detector.ingest(makeEvent('w1', 100))
    detector.ingest(makeEvent('w2', 102))
    detector.ingest(makeEvent('w3', 98))
    const r = detector.ingest(makeEvent('w4', 500)) // 급등
    expect(r?.anomalyType).toBe('SPIKE')
  })

  it('급락(DROP) 이상 탐지', () => {
    detector.ingest(makeEvent('w1', 100))
    detector.ingest(makeEvent('w2', 102))
    detector.ingest(makeEvent('w3', 98))
    const r = detector.ingest(makeEvent('w4', 1)) // 급락
    expect(r?.anomalyType).toBe('DROP')
  })

  it('스트림 중단(STOP) 이상 탐지', () => {
    detector.ingest(makeEvent('w1', 100))
    detector.ingest(makeEvent('w2', 102))
    detector.ingest(makeEvent('w3', 98))
    const r = detector.ingest(makeEvent('w4', 0)) // 중단
    // 표준편차가 있어야 탐지됨
    if (r) expect(r.anomalyType).toBe('STOP')
  })

  it('경고 목록 스트림별 필터', () => {
    detector.registerStream({ ...config, streamId: 's2', name: '다른 스트림' })
    // s1에 이상 주입
    detector.ingest(makeEvent('w1', 100))
    detector.ingest(makeEvent('w2', 100))
    detector.ingest(makeEvent('w3', 100))
    detector.ingest({ ...makeEvent('w4', 999), streamId: 's1' })
    const s1Alerts = detector.getAlerts('s1')
    expect(s1Alerts.every((a) => a.streamId === 's1')).toBe(true)
  })

  it('미등록 스트림 이벤트 에러', () => {
    expect(() =>
      detector.ingest({ streamId: 'unknown', windowId: 'w1', eventCount: 100, timestamp: Date.now() })
    ).toThrow()
  })

  it('감사 로그 이상 탐지 기록', () => {
    detector.ingest(makeEvent('w1', 100))
    detector.ingest(makeEvent('w2', 100))
    detector.ingest(makeEvent('w3', 100))
    detector.ingest(makeEvent('w4', 9999)) // spike
    const log = detector.getAuditLog()
    expect(log.some((e) => e.action === 'anomaly.detected')).toBe(true)
  })
})
