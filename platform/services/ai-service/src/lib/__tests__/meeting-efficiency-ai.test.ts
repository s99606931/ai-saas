/**
 * Unit tests — Meeting Efficiency AI (SVC-AI-ADV-R134 트랙B 2차)
 * Plan SC: FR-R134.1 ~ FR-R134.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MeetingEfficiencyAi } from '../meeting-efficiency-ai'

describe('SVC-AI-ADV-R134 MeetingEfficiencyAi', () => {
  let engine: MeetingEfficiencyAi

  beforeEach(() => {
    engine = new MeetingEfficiencyAi()
  })

  it('[FR-R134.1] 한국어 액션 아이템 추출', () => {
    const text = `
회의록 2026-04-12
담당: 김철수 - 보안 패치 적용
조치: 이영희 - 취약점 보고서 제출
확인: 박민수 - 서버 상태 점검
`
    const items = engine.parseMeetingMinutes(text, 'MTG-001')
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('[FR-R134.1] 영어 액션 아이템 추출', () => {
    const text = `
Meeting 2026-04-12
Action: John - deploy security patch
Todo: Jane - prepare vulnerability report
`
    const items = engine.parseMeetingMinutes(text, 'MTG-002')
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items[0]!.status).toBe('PENDING')
  })

  it('[FR-R134.2] 담당자 배정', () => {
    const items = engine.parseMeetingMinutes('담당: 보안 패치 배포\n', 'MTG-003')
    expect(items.length).toBeGreaterThan(0)
    const updated = engine.assignOwner(items[0]!.actionId, '김철수')
    expect(updated.owner).toBe('김철수')
  })

  it('[FR-R134.3] 상태 업데이트', () => {
    const items = engine.parseMeetingMinutes('담당: 보안 패치 배포\n', 'MTG-004')
    const updated = engine.updateStatus(items[0]!.actionId, 'DONE')
    expect(updated.status).toBe('DONE')
  })

  it('[FR-R134.4] 미완료 액션 조회 — DONE 제외', () => {
    const items = engine.parseMeetingMinutes('담당: A\n담당: B\n', 'MTG-005')
    engine.updateStatus(items[0]!.actionId, 'DONE')
    const pending = engine.getPendingActions()
    expect(pending.every((a) => a.status !== 'DONE')).toBe(true)
  })

  it('[FR-R134.5] CSAP D-06 감사 로그 append-only', () => {
    engine.parseMeetingMinutes('담당: 보안 패치\n', 'MTG-006')
    const log = engine.getAuditLog()
    expect(log.length).toBeGreaterThan(0)
    const copy = engine.getAuditLog()
    copy.push({ timestamp: 'fake', action: 'injected', detail: {} })
    expect(engine.getAuditLog().length).toBe(log.length)
  })
})
