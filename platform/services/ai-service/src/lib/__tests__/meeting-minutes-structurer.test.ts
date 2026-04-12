import { describe, it, expect, beforeEach } from 'vitest'
import { MeetingMinutesStructurer } from '../meeting-minutes-structurer'

const SAMPLE_MINUTES = `
참석자: 김과장, 이대리, 박주임
의제 1: 2026년 예산 검토
의제 2: 보안 정책 개정 안건
결정사항: 예산안 승인
결정사항: 보안 정책 합의
담당: 이대리 처리 2026-05-01까지
조치: 박주임 보고서 완료
`

describe('MeetingMinutesStructurer', () => {
  let structurer: MeetingMinutesStructurer

  beforeEach(() => {
    structurer = new MeetingMinutesStructurer()
  })

  it('N2SF C등급 회의록 처리 차단', () => {
    expect(() => structurer.structure({ meetingId: 'M1', title: '기밀회의', rawText: '내용', date: '2026-04-12', grade: 'C' })).toThrow('BLOCKED')
  })

  it('참석자 추출', () => {
    const result = structurer.structure({ meetingId: 'M2', title: '정기회의', rawText: SAMPLE_MINUTES, date: '2026-04-12' })
    expect(result.attendees).toContain('김과장')
    expect(result.attendees).toContain('이대리')
  })

  it('의제 추출', () => {
    const result = structurer.structure({ meetingId: 'M3', title: '정기회의', rawText: SAMPLE_MINUTES, date: '2026-04-12' })
    expect(result.agendaItems.length).toBeGreaterThan(0)
  })

  it('결정사항 추출', () => {
    const result = structurer.structure({ meetingId: 'M4', title: '정기회의', rawText: SAMPLE_MINUTES, date: '2026-04-12' })
    expect(result.decisions.length).toBeGreaterThan(0)
    expect(result.decisions.some((d) => d.includes('승인') || d.includes('합의'))).toBe(true)
  })

  it('액션아이템 추출', () => {
    const result = structurer.structure({ meetingId: 'M5', title: '정기회의', rawText: SAMPLE_MINUTES, date: '2026-04-12' })
    expect(result.actionItems.length).toBeGreaterThan(0)
  })

  it('요약 문자열 생성', () => {
    const result = structurer.structure({ meetingId: 'M6', title: '정기회의', rawText: SAMPLE_MINUTES, date: '2026-04-12' })
    expect(result.summary).toContain('참석자')
    expect(result.summary).toContain('결정사항')
  })

  it('감사 로그 복사본 반환', () => {
    structurer.structure({ meetingId: 'M7', title: '회의', rawText: '참석자: A\n결정사항: 승인', date: '2026-04-12' })
    const log = structurer.getAuditLog()
    log.push({ timestamp: '', action: 'injected', meetingId: 'X', detail: {} })
    expect(structurer.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
