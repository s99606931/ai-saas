// Plan SC: SVC-AI-ADV-R587-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { SopAutomationAI, type SopDefinition } from '../sop-automation-ai'

describe('SopAutomationAI', () => {
  let automation: SopAutomationAI

  const simpleSop: SopDefinition = {
    sopId: 'SOP-1',
    name: '서버 재시작 절차',
    category: 'INCIDENT',
    status: 'ACTIVE',
    version: '1.0',
    steps: [
      { stepId: 'S1', name: '서비스 중지', description: '운영 서비스 정상 중지', executor: 'SYSTEM', required: true },
      { stepId: 'S2', name: '로그 백업', description: '현재 로그 파일 백업', executor: 'AUTO', required: false },
      { stepId: 'S3', name: '서버 재시작', description: '서버 재시작 명령 실행', executor: 'SYSTEM', required: true },
    ],
  }

  beforeEach(() => {
    automation = new SopAutomationAI()
  })

  it('미등록 SOP 실행 시 오류 발생', () => {
    expect(() => automation.execute('UNKNOWN', {})).toThrow('Unknown SOP')
  })

  it('INACTIVE SOP 실행 시 오류 발생', () => {
    automation.registerSOP({ ...simpleSop, sopId: 'SOP-INACTIVE', status: 'INACTIVE' })
    expect(() => automation.execute('SOP-INACTIVE', {})).toThrow('not active')
  })

  it('정상 실행 → 모든 단계 COMPLETED', () => {
    automation.registerSOP(simpleSop)
    const result = automation.execute('SOP-1', {})
    expect(result.status).toBe('COMPLETED')
    expect(result.steps.every((s) => s.status === 'COMPLETED')).toBe(true)
  })

  it('조건 미충족 단계 → SKIPPED', () => {
    automation.registerSOP({
      ...simpleSop,
      sopId: 'SOP-COND',
      steps: [
        { stepId: 'S1', name: '조건부 단계', description: '조건 확인', executor: 'SYSTEM', required: false, conditionField: 'enableBackup', conditionValue: true },
      ],
    })
    const result = automation.execute('SOP-COND', { enableBackup: false })
    expect(result.steps[0]?.status).toBe('SKIPPED')
  })

  it('조건 충족 단계 → COMPLETED', () => {
    automation.registerSOP({
      ...simpleSop,
      sopId: 'SOP-COND2',
      steps: [
        { stepId: 'S1', name: '조건부 단계', description: '조건 확인', executor: 'SYSTEM', required: true, conditionField: 'enableBackup', conditionValue: true },
      ],
    })
    const result = automation.execute('SOP-COND2', { enableBackup: true })
    expect(result.steps[0]?.status).toBe('COMPLETED')
  })

  it('getExecutionLog: 해당 SOP 실행 이력 반환', () => {
    automation.registerSOP(simpleSop)
    automation.execute('SOP-1', {})
    automation.execute('SOP-1', { retry: true })
    const log = automation.getExecutionLog('SOP-1')
    expect(log).toHaveLength(2)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    automation.registerSOP(simpleSop)
    automation.execute('SOP-1', {})
    const log1 = automation.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', sopId: 'X', detail: {} })
    const log2 = automation.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
