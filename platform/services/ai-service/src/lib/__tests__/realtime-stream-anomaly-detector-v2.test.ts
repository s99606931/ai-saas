// Plan SC: SVC-AI-ADV-R406
import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeStreamAnomalyDetectorV2 } from '../realtime-stream-anomaly-detector-v2'

describe('RealtimeStreamAnomalyDetectorV2', () => {
  let detector: RealtimeStreamAnomalyDetectorV2

  beforeEach(() => {
    detector = new RealtimeStreamAnomalyDetectorV2()
  })

  it('registerStream — 감사 로그에 stream.register 기록', () => {
    detector.registerStream('s1', 'CPU 사용률', 2.0)
    const log = detector.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('stream.register')
  })

  it('recordDataPoint — 첫 번째 데이터 포인트 null 반환', () => {
    detector.registerStream('s1', 'CPU', 2.0)
    expect(detector.recordDataPoint('s1', 50)).toBeNull()
  })

  it('recordDataPoint — 정상 범위 내 데이터 null 반환', () => {
    detector.registerStream('s1', 'CPU', 3.0)
    detector.recordDataPoint('s1', 50)
    detector.recordDataPoint('s1', 52)
    // z-score가 임계 미만
    const result = detector.recordDataPoint('s1', 51)
    expect(result).toBeNull()
  })

  it('recordDataPoint — Z-Score 초과 시 AnomalyEvent 반환', () => {
    detector.registerStream('s1', 'CPU', 1.0) // 낮은 threshold
    detector.recordDataPoint('s1', 50)
    detector.recordDataPoint('s1', 50)
    detector.recordDataPoint('s1', 50)
    // 극단적 이상값
    const result = detector.recordDataPoint('s1', 1000)
    expect(result).not.toBeNull()
    expect(result!.streamId).toBe('s1')
    expect(result!.zScore).toBeGreaterThan(1.0)
  })

  it('getAnomalyEvents — 이상 이벤트 누적 반환', () => {
    detector.registerStream('s1', 'CPU', 1.0)
    for (let i = 0; i < 5; i++) detector.recordDataPoint('s1', 50)
    detector.recordDataPoint('s1', 9999) // anomaly
    const events = detector.getAnomalyEvents('s1')
    expect(events.length).toBeGreaterThanOrEqual(1)
  })

  it('recordDataPoint — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    detector.registerStream('s1', 'CPU', 2.0)
    expect(() => detector.recordDataPoint('s1', 50, 'C')).toThrow('BLOCKED')
  })

  it('recordDataPoint — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    detector.registerStream('s1', 'CPU', 2.0)
    expect(() => detector.recordDataPoint('s1', 50, 'S')).toThrow('N2SF N-05')
  })

  it('getAnomalyEvents — 없는 streamId 에러', () => {
    expect(() => detector.getAnomalyEvents('nonexistent')).toThrow('streamId 없음')
  })
})
