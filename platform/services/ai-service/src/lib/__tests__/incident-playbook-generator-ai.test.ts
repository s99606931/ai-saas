// Design Ref: §R390 — AI기반 자동 장애 복구 플레이북 생성
import { describe, it, expect, beforeEach } from 'vitest'
import { IncidentPlaybookGeneratorAi, type IncidentContext } from '../incident-playbook-generator-ai'

describe('IncidentPlaybookGeneratorAi', () => {
  let generator: IncidentPlaybookGeneratorAi

  beforeEach(() => {
    generator = new IncidentPlaybookGeneratorAi()
  })

  it('SEV1: 전쟁방 단계 및 에스컬레이션 포함', () => {
    const ctx: IncidentContext = {
      incidentId: 'INC-001',
      serviceId: 'svc-prod',
      severity: 'SEV1',
      symptoms: [],
      affectedComponents: ['API Gateway'],
      environmentType: 'PRODUCTION',
    }
    const playbook = generator.generate(ctx)
    expect(playbook.steps.some((s) => s.action.includes('전쟁방'))).toBe(true)
    expect(playbook.escalationContacts).toContain('CTO')
  })

  it('SEV2: 롤백 검토 단계 포함', () => {
    const ctx: IncidentContext = {
      incidentId: 'INC-002',
      serviceId: 'svc-prod',
      severity: 'SEV2',
      symptoms: [],
      affectedComponents: ['DB'],
      environmentType: 'PRODUCTION',
    }
    const playbook = generator.generate(ctx)
    expect(playbook.steps.some((s) => s.rollbackPossible)).toBe(true)
  })

  it('SEV3: 에스컬레이션 없음, 로그 분석 단계 포함', () => {
    const ctx: IncidentContext = {
      incidentId: 'INC-003',
      serviceId: 'svc-dev',
      severity: 'SEV3',
      symptoms: [],
      affectedComponents: ['Service A'],
      environmentType: 'DEV',
    }
    const playbook = generator.generate(ctx)
    expect(playbook.escalationContacts).toHaveLength(0)
    expect(playbook.steps.some((s) => s.action.includes('로그 분석'))).toBe(true)
  })

  it('증상 DB: DB 커넥션 풀 단계 추가', () => {
    const ctx: IncidentContext = {
      incidentId: 'INC-004',
      serviceId: 'svc-api',
      severity: 'SEV3',
      symptoms: ['DB 응답 없음'],
      affectedComponents: ['DB'],
      environmentType: 'STAGING',
    }
    const playbook = generator.generate(ctx)
    expect(playbook.steps.some((s) => s.action.includes('DB 커넥션'))).toBe(true)
  })

  it('증상 메모리: 메모리 누수 재시작 단계 추가', () => {
    const ctx: IncidentContext = {
      incidentId: 'INC-005',
      serviceId: 'svc-api',
      severity: 'SEV4',
      symptoms: ['메모리 사용률 98%'],
      affectedComponents: ['Worker'],
      environmentType: 'PRODUCTION',
    }
    const playbook = generator.generate(ctx)
    expect(playbook.steps.some((s) => s.action.includes('메모리 누수'))).toBe(true)
  })

  it('totalEstimatedMinutes: 모든 단계 합산', () => {
    const ctx: IncidentContext = {
      incidentId: 'INC-006',
      serviceId: 'svc-x',
      severity: 'SEV4',
      symptoms: [],
      affectedComponents: ['Service X'],
      environmentType: 'PRODUCTION',
    }
    const playbook = generator.generate(ctx)
    const expected = playbook.steps.reduce((s, st) => s + st.estimatedMinutes, 0)
    expect(playbook.totalEstimatedMinutes).toBe(expected)
  })

  it('감사 로그에 generate 기록', () => {
    const ctx: IncidentContext = {
      incidentId: 'INC-007',
      serviceId: 'svc-y',
      severity: 'SEV1',
      symptoms: [],
      affectedComponents: [],
      environmentType: 'PRODUCTION',
    }
    generator.generate(ctx)
    const logs = generator.getAuditLog()
    expect(logs.some((l) => l.action === 'playbook.generate')).toBe(true)
  })
})
