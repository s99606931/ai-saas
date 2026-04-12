import { describe, it, expect, beforeEach } from 'vitest'
import { MultiAgentOrchestratorV2 } from '../multi-agent-orchestrator-v2'

describe('MultiAgentOrchestratorV2', () => {
  let orchestrator: MultiAgentOrchestratorV2

  beforeEach(() => {
    orchestrator = new MultiAgentOrchestratorV2()
    orchestrator.registerAgent({ agentId: 'AG-1', name: '문서 분석 에이전트', capabilities: ['ocr', 'nlp'], maxConcurrent: 3 })
    orchestrator.registerAgent({ agentId: 'AG-2', name: '요약 에이전트', capabilities: ['summarize'], maxConcurrent: 2 })
  })

  it('N2SF C등급 태스크 처리 차단', () => {
    expect(() => orchestrator.submit({ taskId: 'T-1', agentId: 'AG-1', input: '기밀 내용', grade: 'C' })).toThrow('BLOCKED')
  })

  it('알 수 없는 에이전트 태스크 오류', () => {
    expect(() => orchestrator.submit({ taskId: 'T-2', agentId: 'UNKNOWN', input: '내용' })).toThrow('Unknown agent')
  })

  it('태스크 제출 및 완료 처리', () => {
    const result = orchestrator.submit({ taskId: 'T-3', agentId: 'AG-1', input: '문서 분석 요청' })
    expect(result.status).toBe('DONE')
    expect(result.output).toBeDefined()
  })

  it('의존성 미충족 시 오류', () => {
    expect(() => orchestrator.submit({ taskId: 'T-4', agentId: 'AG-2', input: '요약', dependsOn: ['T-999'] })).toThrow('Dependency not satisfied')
  })

  it('의존성 충족 시 태스크 실행', () => {
    orchestrator.submit({ taskId: 'T-5', agentId: 'AG-1', input: '선행 태스크' })
    const result = orchestrator.submit({ taskId: 'T-6', agentId: 'AG-2', input: '후속 태스크', dependsOn: ['T-5'] })
    expect(result.status).toBe('DONE')
  })

  it('알 수 없는 태스크 결과 조회 시 오류', () => {
    expect(() => orchestrator.getResult('UNKNOWN')).toThrow('Unknown task')
  })

  it('감사 로그 복사본 반환', () => {
    orchestrator.submit({ taskId: 'T-7', agentId: 'AG-1', input: '내용' })
    const log = orchestrator.getAuditLog()
    log.push({ timestamp: '', action: 'injected', taskId: 'X', detail: {} })
    expect(orchestrator.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
