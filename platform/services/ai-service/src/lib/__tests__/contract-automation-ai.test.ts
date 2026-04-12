/**
 * Unit tests — Contract Automation AI (SVC-AI-ADV-R135 트랙B 2차)
 * Plan SC: FR-R135.1 ~ FR-R135.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ContractAutomationAi } from '../contract-automation-ai'

describe('SVC-AI-ADV-R135 ContractAutomationAi', () => {
  let engine: ContractAutomationAi

  beforeEach(() => {
    engine = new ContractAutomationAi()
    engine.registerClauseTemplate({
      templateId: 'T-001',
      type: 'SERVICE',
      title: '계약 목적',
      body: '본 계약은 {{service_name}} 서비스 제공을 목적으로 한다.',
      order: 1,
    })
    engine.registerClauseTemplate({
      templateId: 'T-002',
      type: 'SERVICE',
      title: '계약 기간',
      body: '계약 기간은 {{start_date}}부터 {{end_date}}까지로 한다.',
      order: 2,
    })
  })

  it('[FR-R135.2] 변수 치환된 계약서 초안 생성', () => {
    const draft = engine.generateContract('SERVICE', {
      service_name: 'AI 서비스',
      start_date: '2026-05-01',
      end_date: '2027-04-30',
    })
    expect(draft.clauses).toHaveLength(2)
    expect(draft.clauses[0]).toContain('AI 서비스')
    expect(draft.clauses[1]).toContain('2026-05-01')
    expect(draft.contractId).toBeDefined()
  })

  it('[FR-R135.2] 미등록 계약 유형 — 빈 조항 반환', () => {
    const draft = engine.generateContract('UNKNOWN_TYPE', {})
    expect(draft.clauses).toHaveLength(0)
  })

  it('[FR-R135.3] 기본 리스크 패턴 — 일방적 해지 탐지', () => {
    const text = '갑은 필요 시 일방적 계약해제를 요청할 수 있다.'
    const detections = engine.detectRiskClauses(text)
    expect(detections.length).toBeGreaterThan(0)
    expect(detections[0]!.severity).toBe('HIGH')
  })

  it('[FR-R135.4] 커스텀 리스크 패턴 등록 후 탐지', () => {
    engine.addRiskPattern({
      patternId: 'RP-CUSTOM',
      pattern: String.raw`독점\s*공급`,
      description: '독점 공급 조항',
      severity: 'HIGH',
    })
    const detections = engine.detectRiskClauses('독점 공급 계약 체결')
    const custom = detections.find((d) => d.patternId === 'RP-CUSTOM')
    expect(custom).toBeDefined()
  })

  it('[FR-R135.4] 유효하지 않은 패턴 등록 시 에러', () => {
    expect(() =>
      engine.addRiskPattern({
        patternId: 'RP-BAD',
        pattern: '[invalid',
        description: 'bad',
        severity: 'LOW',
      }),
    ).toThrow('유효하지 않은 정규식')
  })

  it('[FR-R135.5] CSAP D-06 감사 로그 append-only', () => {
    engine.generateContract('SERVICE', {})
    engine.detectRiskClauses('일방적 해지')
    const log = engine.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
    const copy = engine.getAuditLog()
    copy.push({ timestamp: 'fake', action: 'injected', detail: {} })
    expect(engine.getAuditLog().length).toBe(log.length)
  })
})
