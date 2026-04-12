import { describe, it, expect, beforeEach } from 'vitest'
import { DrRunbookExecutor } from '../dr-runbook-executor'

describe('DrRunbookExecutor', () => {
  let exe: DrRunbookExecutor

  beforeEach(() => {
    exe = new DrRunbookExecutor()
    exe.registerRunbook(
      {
        runbookId: 'rb-1',
        approver: 'admin-super',
        steps: [
          { stepId: 's1', name: '백업 확인', dependsOn: [] },
          { stepId: 's2', name: '복구 실행', dependsOn: ['s1'] },
          { stepId: 's3', name: '검증', dependsOn: ['s2'] },
        ],
      },
      'O',
      'caller-a'
    )
  })

  it('C등급 차단', () => {
    expect(() =>
      exe.registerRunbook(
        { runbookId: 'x', approver: 'a', steps: [{ stepId: 's', name: 'n', dependsOn: [] }] },
        'C',
        'c'
      )
    ).toThrow('BLOCKED')
  })

  it('빈 runbookId 차단', () => {
    expect(() =>
      exe.registerRunbook(
        { runbookId: '', approver: 'a', steps: [{ stepId: 's', name: 'n', dependsOn: [] }] },
        'O',
        'c'
      )
    ).toThrow('runbookId')
  })

  it('빈 steps 차단', () => {
    expect(() =>
      exe.registerRunbook({ runbookId: 'x', approver: 'a', steps: [] }, 'O', 'c')
    ).toThrow('steps')
  })

  it('잘못된 의존 단계 차단', () => {
    expect(() =>
      exe.registerRunbook(
        {
          runbookId: 'bad',
          approver: 'a',
          steps: [{ stepId: 's1', name: 'n', dependsOn: ['ghost'] }],
        },
        'O',
        'c'
      )
    ).toThrow('잘못된 의존')
  })

  it('중복 runbookId 차단', () => {
    expect(() =>
      exe.registerRunbook(
        { runbookId: 'rb-1', approver: 'a', steps: [{ stepId: 's', name: 'n', dependsOn: [] }] },
        'O',
        'c'
      )
    ).toThrow('중복')
  })

  it('의존성 미완료 단계 실행 차단', () => {
    expect(() => exe.executeStep('rb-1', 's2', true)).toThrow('의존 단계 미완료')
  })

  it('순차 실행 성공', () => {
    exe.executeStep('rb-1', 's1', true)
    exe.executeStep('rb-1', 's2', true)
    exe.executeStep('rb-1', 's3', true)
    const st = exe.getStatus('rb-1')
    expect(st.completed).toBe(3)
    expect(st.progressPct).toBe(100)
    expect(st.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('실패 단계 기록 + 재시도 카운트', () => {
    exe.executeStep('rb-1', 's1', false, 'backup missing')
    const st = exe.getStatus('rb-1')
    expect(st.failed).toBe(1)
    expect(st.progressPct).toBe(0)
  })

  it('이미 완료된 단계 재실행 차단', () => {
    exe.executeStep('rb-1', 's1', true)
    expect(() => exe.executeStep('rb-1', 's1', true)).toThrow('이미 완료')
  })

  it('롤백 — 실패 단계', () => {
    exe.executeStep('rb-1', 's1', false, 'err')
    const s = exe.rollback('rb-1', 's1')
    expect(s.status).toBe('ROLLED_BACK')
  })

  it('PENDING 롤백 차단', () => {
    expect(() => exe.rollback('rb-1', 's1')).toThrow('롤백 불가')
  })

  it('없는 runbookId 오류', () => {
    expect(() => exe.getStatus('none')).toThrow('runbookId 없음')
  })

  it('없는 stepId 오류', () => {
    expect(() => exe.executeStep('rb-1', 'ghost', true)).toThrow('stepId 없음')
  })

  it('listRunbooks 반환', () => {
    expect(exe.listRunbooks()).toContain('rb-1')
  })

  it('진행률 — 1/3 완료', () => {
    exe.executeStep('rb-1', 's1', true)
    const st = exe.getStatus('rb-1')
    expect(st.progressPct).toBe(33)
    expect(st.pending).toBe(2)
  })

  it('감사 로그 — approver 마스킹', () => {
    const log = exe.getAuditLog()
    const reg = log.find((e) => e.action === 'runbook.register')
    expect(reg?.detail.approverMasked).toContain('***')
    expect(reg?.detail.approverMasked).not.toBe('admin-super')
  })
})
