/**
 * Unit tests for AI Incident Response Playbook — SVC-AI-ADV-R104
 */

import { describe, it, expect } from 'vitest'
import {
  AiIncidentResponsePlaybook,
  type Playbook,
  type StepExecutor,
} from '../ai-incident-response-playbook'

const hallucinationPlaybook: Playbook = {
  incidentType: 'ai.hallucination',
  defaultSeverity: 'high',
  steps: [
    { id: 'isolate', description: '모델 격리', action: 'disable-model' },
    { id: 'rollback', description: '이전 버전 복구', action: 'rollback' },
    { id: 'notify', description: '운영자 알림', action: 'notify-ops' },
  ],
}

const okExecutor: StepExecutor = async (action) => ({
  success: true,
  output: `${action} ok`,
})

describe('SVC-AI-ADV-R104 AiIncidentResponsePlaybook', () => {
  it('[FR-R104.1] registers a playbook', () => {
    const p = new AiIncidentResponsePlaybook()
    p.registerPlaybook(hallucinationPlaybook)
    const log = p.getAuditLog()
    expect(log[0]!.action).toBe('registerPlaybook')
  })

  it('[FR-R104.1] rejects empty steps', () => {
    const p = new AiIncidentResponsePlaybook()
    expect(() =>
      p.registerPlaybook({
        incidentType: 't',
        defaultSeverity: 'low',
        steps: [],
      }),
    ).toThrow(/at least one step/)
  })

  it('[FR-R104.2] triage matches by keyword', () => {
    const p = new AiIncidentResponsePlaybook()
    p.registerPlaybook(hallucinationPlaybook)
    const result = p.triage({
      incidentId: 'i1',
      summary: 'Detected hallucination in chatbot',
    })
    expect(result.incidentType).toBe('ai.hallucination')
    expect(result.severity).toBe('high')
  })

  it('[FR-R104.2] triage upgrades severity from hint', () => {
    const p = new AiIncidentResponsePlaybook()
    p.registerPlaybook(hallucinationPlaybook)
    const result = p.triage({
      incidentId: 'i2',
      summary: 'bias 문제 발생',
      severityHint: 'critical',
    })
    expect(result.severity).toBe('critical')
  })

  it('[FR-R104.3] executes all steps on success', async () => {
    const p = new AiIncidentResponsePlaybook()
    p.registerPlaybook(hallucinationPlaybook)
    const incident = await p.executePlaybook(
      'i1',
      'ai.hallucination',
      okExecutor,
    )
    expect(incident.status).toBe('resolved')
    expect(incident.stepResults).toHaveLength(3)
    expect(incident.completedAt).toBeDefined()
  })

  it('[FR-R104.3] stops on first failing step', async () => {
    const p = new AiIncidentResponsePlaybook()
    p.registerPlaybook(hallucinationPlaybook)
    const failExecutor: StepExecutor = async (action) => ({
      success: action !== 'rollback',
      output: action === 'rollback' ? 'version not found' : 'ok',
    })
    const incident = await p.executePlaybook(
      'i2',
      'ai.hallucination',
      failExecutor,
    )
    expect(incident.status).toBe('failed')
    expect(incident.stepResults).toHaveLength(2) // isolate + rollback
    expect(incident.stepResults[1]!.success).toBe(false)
  })

  it('[FR-R104.3] throws on unknown playbook type', async () => {
    const p = new AiIncidentResponsePlaybook()
    await expect(
      p.executePlaybook('i3', 'unknown', okExecutor),
    ).rejects.toThrow(/no playbook/)
  })

  it('[FR-R104.4] getIncidentStatus returns null for unknown', () => {
    const p = new AiIncidentResponsePlaybook()
    expect(p.getIncidentStatus('missing')).toBeNull()
  })

  it('[FR-R104.5] listActiveIncidents excludes resolved', async () => {
    const p = new AiIncidentResponsePlaybook()
    p.registerPlaybook(hallucinationPlaybook)
    await p.executePlaybook('i1', 'ai.hallucination', okExecutor)
    const active = p.listActiveIncidents()
    expect(active).toHaveLength(0)
  })

  it('[CSAP D-06] audit logs include incidentResolved', async () => {
    const p = new AiIncidentResponsePlaybook()
    p.registerPlaybook(hallucinationPlaybook)
    await p.executePlaybook('i1', 'ai.hallucination', okExecutor)
    const actions = p.getAuditLog().map((l) => l.action)
    expect(actions).toContain('incidentResolved')
    expect(actions.filter((a) => a === 'stepExecuted')).toHaveLength(3)
  })
})
