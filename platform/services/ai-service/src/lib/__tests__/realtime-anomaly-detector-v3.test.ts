import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeAnomalyDetectorV3, type MetricStream, type MetricDataPoint } from '../realtime-anomaly-detector-v3'

describe('RealtimeAnomalyDetectorV3', () => {
  let detector: RealtimeAnomalyDetectorV3

  const stream: MetricStream = {
    streamId: 'STR001',
    serviceId: 'SVC001',
    metricName: 'response_time_ms',
    baselineAvg: 200,
    baselineStdDev: 50,
    dataGrade: 'O',
  }

  const normalPoint: MetricDataPoint = {
    streamId: 'STR001',
    timestamp: Date.now(),
    value: 210,
  }

  beforeEach(() => {
    detector = new RealtimeAnomalyDetectorV3()
    detector.registerStream(stream)
  })

  it('C/S 등급 스트림 차단', () => {
    expect(() => detector.registerStream({ ...stream, streamId: 'C_STR', dataGrade: 'C' })).toThrow('BLOCKED')
    expect(() => detector.registerStream({ ...stream, streamId: 'S_STR', dataGrade: 'S' })).toThrow('BLOCKED')
  })

  it('정상 범위 → NONE, alert false', () => {
    const result = detector.detect(normalPoint)
    expect(result.anomalyLevel).toBe('NONE')
    expect(result.alert).toBe(false)
  })

  it('z-score 2 이상 → WARNING', () => {
    // 200 + 2*50 = 300
    const result = detector.detect({ ...normalPoint, value: 310 })
    expect(result.anomalyLevel).toBe('WARNING')
  })

  it('z-score 3 이상 → ANOMALY, alert true', () => {
    // 200 + 3*50 = 350
    const result = detector.detect({ ...normalPoint, value: 360 })
    expect(result.anomalyLevel).toBe('ANOMALY')
    expect(result.alert).toBe(true)
  })

  it('z-score 4 이상 → CRITICAL', () => {
    // 200 + 4*50 = 400
    const result = detector.detect({ ...normalPoint, value: 410 })
    expect(result.anomalyLevel).toBe('CRITICAL')
  })

  it('편차 퍼센트 계산 포함', () => {
    const result = detector.detect({ ...normalPoint, value: 400 })
    expect(result.deviationPercent).toBeGreaterThan(0)
  })

  it('미등록 스트림 에러', () => {
    expect(() => detector.detect({ ...normalPoint, streamId: 'UNKNOWN' })).toThrow()
  })

  it('탐지 후 감사 로그', () => {
    detector.detect(normalPoint)
    const log = detector.getAuditLog()
    expect(log.some((e) => e.action === 'anomaly.detect')).toBe(true)
  })
})
