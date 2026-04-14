import { describe, it, expect, beforeEach } from 'vitest'
import { UserBehaviorAnalyzerV2 } from '../user-behavior-analyzer-v2'

describe('UserBehaviorAnalyzerV2', () => {
  let analyzer: UserBehaviorAnalyzerV2
  beforeEach(() => { analyzer = new UserBehaviorAnalyzerV2() })

  it('세션 등록 후 조회 가능', () => {
    const session = analyzer.registerSession('ses-1', 'user-1', 'svc-1')
    expect(session.sessionId).toBe('ses-1')
    expect(session.serviceId).toBe('svc-1')
  })

  it('이벤트 없으면 참여도 0', () => {
    analyzer.registerSession('ses-1', 'user-1', 'svc-1')
    expect(analyzer.getEngagementScore('ses-1')).toBe(0)
  })

  it('참여도 점수: eventCount * avgDuration', () => {
    analyzer.registerSession('ses-1', 'user-1', 'svc-1')
    analyzer.recordEvent('ses-1', 'click', 5)
    analyzer.recordEvent('ses-1', 'scroll', 5)
    // 2 * 5 = 10
    expect(analyzer.getEngagementScore('ses-1')).toBe(10)
  })

  it('getLowEngagementSessions: score < 10', () => {
    analyzer.registerSession('ses-1', 'user-1', 'svc-1')
    analyzer.registerSession('ses-2', 'user-2', 'svc-1')
    analyzer.recordEvent('ses-1', 'click', 1)
    analyzer.recordEvent('ses-2', 'click', 20)
    const low = analyzer.getLowEngagementSessions()
    expect(low.map(s => s.sessionId)).toContain('ses-1')
    expect(low.map(s => s.sessionId)).not.toContain('ses-2')
  })

  it('C등급 데이터 전송 차단', () => {
    analyzer.registerSession('ses-1', 'user-1', 'svc-1')
    expect(() => analyzer.recordEvent('ses-1', 'click', 5, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    analyzer.registerSession('ses-1', 'user-1', 'svc-1')
    expect(() => analyzer.recordEvent('ses-1', 'click', 5, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그: PII 마스킹 확인', () => {
    analyzer.registerSession('ses-1', 'user-1', 'svc-1')
    const log = analyzer.getAuditLog()
    expect(log[0]!.maskedUserId).toBeDefined()
    expect(log[0]!.maskedUserId).not.toBe('user-1')
  })

  it('감사 로그 기록', () => {
    analyzer.registerSession('ses-1', 'user-1', 'svc-1')
    analyzer.recordEvent('ses-1', 'click', 5)
    expect(analyzer.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
