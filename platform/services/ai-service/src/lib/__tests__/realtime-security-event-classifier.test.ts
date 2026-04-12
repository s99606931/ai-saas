import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeSecurityEventClassifier } from '../realtime-security-event-classifier'

describe('RealtimeSecurityEventClassifier', () => {
  let classifier: RealtimeSecurityEventClassifier

  beforeEach(() => {
    classifier = new RealtimeSecurityEventClassifier()
  })

  it('AUTH 카테고리 분류', () => {
    const result = classifier.classify({ eventId: 'EV-1', source: 'auth-service', message: 'login failed multiple times', timestamp: '2026-04-12T10:00:00Z' })
    expect(result.category).toBe('AUTH')
  })

  it('NETWORK 카테고리 분류', () => {
    const result = classifier.classify({ eventId: 'EV-2', source: 'firewall', message: 'port scan detected', timestamp: '2026-04-12T10:00:00Z' })
    expect(result.category).toBe('NETWORK')
  })

  it('DATA 카테고리 — CRITICAL 위협', () => {
    const result = classifier.classify({ eventId: 'EV-3', source: 'dlp', message: 'data exfil detected leak', timestamp: '2026-04-12T10:00:00Z' })
    expect(result.category).toBe('DATA')
    expect(result.threatLevel).toBe('CRITICAL')
  })

  it('rawScore 기반 위협 수준 결정', () => {
    const result = classifier.classify({ eventId: 'EV-4', source: 'siem', message: '이상 이벤트', timestamp: '2026-04-12T10:00:00Z', rawScore: 0.95 })
    expect(result.threatLevel).toBe('CRITICAL')
    expect(result.confidence).toBe(0.95)
  })

  it('무관한 메시지 — INFO 수준', () => {
    const result = classifier.classify({ eventId: 'EV-5', source: 'app', message: '일반 로그 메시지입니다', timestamp: '2026-04-12T10:00:00Z' })
    expect(result.threatLevel).toBe('INFO')
  })

  it('완화 권고 문자열 반환', () => {
    const result = classifier.classify({ eventId: 'EV-6', source: 'dlp', message: 'data exfil detected', timestamp: '2026-04-12T10:00:00Z' })
    expect(result.mitigationSuggestion.length).toBeGreaterThan(0)
  })

  it('감사 로그 복사본 반환', () => {
    classifier.classify({ eventId: 'EV-7', source: 'app', message: '테스트', timestamp: '2026-04-12T10:00:00Z' })
    const log = classifier.getAuditLog()
    log.push({ timestamp: '', action: 'injected', eventId: 'X', detail: {} })
    expect(classifier.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
