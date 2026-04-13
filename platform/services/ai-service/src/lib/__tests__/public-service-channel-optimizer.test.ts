// Plan SC: SVC-AI-ADV-R344
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceChannelOptimizer } from '../public-service-channel-optimizer'

describe('PublicServiceChannelOptimizer', () => {
  let optimizer: PublicServiceChannelOptimizer

  beforeEach(() => {
    optimizer = new PublicServiceChannelOptimizer()
  })

  it('registerChannel — 감사 로그에 channel.register 기록', () => {
    optimizer.registerChannel('ch-1', '모바일앱', 'mobile')
    const log = optimizer.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('channel.register')
    expect(log[0]!.detail).toBe('ch-1')
  })

  it('getChannelStats — totalUsage, avgSatisfaction, channelScore 계산', () => {
    optimizer.registerChannel('ch-1', '모바일앱', 'mobile')
    optimizer.recordUsage('ch-1', 200, 4.5)
    optimizer.recordUsage('ch-1', 300, 3.5)
    const stats = optimizer.getChannelStats('ch-1')
    expect(stats.totalUsage).toBe(500)
    // avgSatisfaction: (4.5+3.5)/2 = 4.0
    expect(stats.avgSatisfaction).toBe(4.0)
    // channelScore: round(500 * 4.0) / 100 = 20.0
    expect(stats.channelScore).toBe(20.0)
  })

  it('getOptimalChannel — channelScore 가장 높은 채널 반환', () => {
    optimizer.registerChannel('ch-1', '모바일앱', 'mobile')
    optimizer.registerChannel('ch-2', '웹포털', 'web')
    optimizer.recordUsage('ch-1', 1000, 4.5) // score = round(1000*4.5)/100 = 45
    optimizer.recordUsage('ch-2', 500, 3.0)  // score = round(500*3.0)/100 = 15
    const optimal = optimizer.getOptimalChannel()
    expect(optimal.channelId).toBe('ch-1')
  })

  it('getChannelStats — 사용 이벤트 없을 때 avgSatisfaction=0, channelScore=0', () => {
    optimizer.registerChannel('ch-1', '모바일앱', 'mobile')
    const stats = optimizer.getChannelStats('ch-1')
    expect(stats.totalUsage).toBe(0)
    expect(stats.avgSatisfaction).toBe(0)
    expect(stats.channelScore).toBe(0)
  })

  it('recordUsage — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    optimizer.registerChannel('ch-1', '모바일앱', 'mobile')
    expect(() => optimizer.recordUsage('ch-1', 100, 4.0, 'C')).toThrow('BLOCKED')
  })

  it('recordUsage — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    optimizer.registerChannel('ch-1', '모바일앱', 'mobile')
    expect(() => optimizer.recordUsage('ch-1', 100, 4.0, 'S')).toThrow('N2SF N-05')
  })

  it('getOptimalChannel — 채널 없을 때 에러', () => {
    expect(() => optimizer.getOptimalChannel()).toThrow('등록된 채널이 없습니다')
  })

  it('recordUsage — 없는 channelId 에러', () => {
    expect(() => optimizer.recordUsage('nonexistent', 100, 4.0)).toThrow('channelId 없음')
  })
})
