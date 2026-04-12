import { describe, it, expect, beforeEach } from 'vitest'
import { IncidentAutoResponderAI } from '../incident-auto-responder-ai'

describe('IncidentAutoResponderAI', () => {
  let responder: IncidentAutoResponderAI

  beforeEach(() => {
    responder = new IncidentAutoResponderAI()
  })

  it('P1 인시던트 — PAGE_ONCALL 액션 포함', () => {
    const response = responder.registerIncident({ incidentId: 'INC-1', title: '서비스 전체 장애', description: '전체 중단', affectedService: 'api', severity: 'P1', detectedAt: '2026-04-12T10:00:00Z' })
    expect(response.actions.some((a) => a.type === 'PAGE_ONCALL')).toBe(true)
    expect(response.assignedTo).toBe('ONCALL_PRIMARY')
  })

  it('P4 인시던트 — PAGE_ONCALL 없음', () => {
    const response = responder.registerIncident({ incidentId: 'INC-2', title: '사소한 경고', description: '경고', affectedService: 'monitor', severity: 'P4', detectedAt: '2026-04-12T10:00:00Z' })
    expect(response.actions.some((a) => a.type === 'PAGE_ONCALL')).toBe(false)
  })

  it('인시던트 등록 시 INVESTIGATING 상태', () => {
    const response = responder.registerIncident({ incidentId: 'INC-3', title: '장애', description: '설명', affectedService: 'svc', severity: 'P2', detectedAt: '2026-04-12T10:00:00Z' })
    expect(response.status).toBe('INVESTIGATING')
  })

  it('상태 업데이트', () => {
    responder.registerIncident({ incidentId: 'INC-4', title: '장애', description: '설명', affectedService: 'svc', severity: 'P2', detectedAt: '2026-04-12T10:00:00Z' })
    responder.updateStatus('INC-4', 'RESOLVED')
    const response = responder.getResponse('INC-4')
    expect(response.status).toBe('RESOLVED')
  })

  it('알 수 없는 인시던트 상태 업데이트 시 오류', () => {
    expect(() => responder.updateStatus('UNKNOWN', 'RESOLVED')).toThrow('Unknown incident')
  })

  it('P1 예상 해결 시간 30분', () => {
    const response = responder.registerIncident({ incidentId: 'INC-5', title: '장애', description: '설명', affectedService: 'svc', severity: 'P1', detectedAt: '2026-04-12T10:00:00Z' })
    expect(response.estimatedResolutionMin).toBe(30)
  })

  it('감사 로그 복사본 반환', () => {
    responder.registerIncident({ incidentId: 'INC-6', title: '장애', description: '설명', affectedService: 'svc', severity: 'P3', detectedAt: '2026-04-12T10:00:00Z' })
    const log = responder.getAuditLog()
    log.push({ timestamp: '', action: 'injected', incidentId: 'X', detail: {} })
    expect(responder.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
