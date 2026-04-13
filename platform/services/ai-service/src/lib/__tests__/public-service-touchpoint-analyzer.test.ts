// Plan SC: SVC-AI-ADV-R443
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceTouchpointAnalyzer } from '../public-service-touchpoint-analyzer'

describe('PublicServiceTouchpointAnalyzer', () => {
  let analyzer: PublicServiceTouchpointAnalyzer

  beforeEach(() => {
    analyzer = new PublicServiceTouchpointAnalyzer()
  })

  it('registerTouchpoint — 감사 로그에 touchpoint.register 기록', () => {
    analyzer.registerTouchpoint('tp-1', '민원 창구', 'offline')
    expect(analyzer.getAuditLog()[0]!.action).toBe('touchpoint.register')
  })

  it('recordInteraction — PII maskedCitizenId 16자 hex (원본 노출 없음)', () => {
    analyzer.registerTouchpoint('tp-1', '민원 창구', 'offline')
    analyzer.recordInteraction('tp-1', 'citizen001', 4, 3000)
    const log = analyzer.getAuditLog()
    expect(log[1]!.detail).not.toContain('citizen001')
  })

  it('getTouchpointStats — 평균 만족도 및 대기시간 계산', () => {
    analyzer.registerTouchpoint('tp-1', '민원 창구', 'offline')
    analyzer.recordInteraction('tp-1', 'c1', 3, 2000)
    analyzer.recordInteraction('tp-1', 'c2', 5, 4000)
    const stats = analyzer.getTouchpointStats('tp-1')
    expect(stats.avgSatisfaction).toBe(4)
    expect(stats.avgWaitTimeMs).toBe(3000)
    expect(stats.count).toBe(2)
  })

  it('getTouchpointStats — 상호작용 없을 때 0', () => {
    analyzer.registerTouchpoint('tp-1', '민원 창구', 'offline')
    const stats = analyzer.getTouchpointStats('tp-1')
    expect(stats.avgSatisfaction).toBe(0)
    expect(stats.count).toBe(0)
  })

  it('getLowSatisfactionTouchpoints — threshold 미만 접점 반환', () => {
    analyzer.registerTouchpoint('tp-1', '창구1', 'offline')
    analyzer.registerTouchpoint('tp-2', '창구2', 'online')
    analyzer.recordInteraction('tp-1', 'c1', 2, 1000) // avg=2
    analyzer.recordInteraction('tp-2', 'c2', 5, 500)  // avg=5
    const low = analyzer.getLowSatisfactionTouchpoints(3)
    expect(low).toHaveLength(1)
    expect(low[0]!.touchpointId).toBe('tp-1')
  })

  it('recordInteraction — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    analyzer.registerTouchpoint('tp-1', '창구', 'offline')
    expect(() => analyzer.recordInteraction('tp-1', 'c1', 3, 1000, 'C')).toThrow('BLOCKED')
  })

  it('recordInteraction — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    analyzer.registerTouchpoint('tp-1', '창구', 'offline')
    expect(() => analyzer.recordInteraction('tp-1', 'c1', 3, 1000, 'S')).toThrow('N2SF N-05')
  })

  it('getLowSatisfactionTouchpoints — 상호작용 없는 접점 포함 (avgSatisfaction=0)', () => {
    analyzer.registerTouchpoint('tp-1', '창구', 'offline')
    const low = analyzer.getLowSatisfactionTouchpoints(1)
    expect(low).toHaveLength(1)
  })
})
