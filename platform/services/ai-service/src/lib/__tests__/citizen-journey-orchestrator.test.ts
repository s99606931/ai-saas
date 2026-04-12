/**
 * Unit tests for Citizen Journey Orchestrator — SVC-AI-ADV-R141
 */

import { describe, it, expect } from 'vitest'
import {
  CitizenJourneyOrchestrator,
  type JourneyStage,
} from '../citizen-journey-orchestrator'

const CITIZEN_HASH = 'abcdef1234567890'

function setupOrchestrator(now: () => number) {
  const o = new CitizenJourneyOrchestrator({ now })
  const stages: JourneyStage[] = [
    { id: 'intake', slaMinutes: 60, nextOnSuccess: 'review', nextOnFailure: 'rejected' },
    { id: 'review', slaMinutes: 240, nextOnSuccess: 'process', nextOnFailure: 'rejected' },
    { id: 'process', slaMinutes: 480, nextOnSuccess: 'notify' },
    { id: 'notify', slaMinutes: 30, terminal: true },
    { id: 'rejected', slaMinutes: 10, terminal: true },
  ]
  for (const s of stages) o.defineStage(s)
  return o
}

describe('SVC-AI-ADV-R141 CitizenJourneyOrchestrator', () => {
  it('[FR-R141.1] registers valid stage', () => {
    const o = new CitizenJourneyOrchestrator()
    expect(() => o.defineStage({ id: 's1', slaMinutes: 10 })).not.toThrow()
  })

  it('[FR-R141.1] rejects invalid slaMinutes', () => {
    const o = new CitizenJourneyOrchestrator()
    expect(() => o.defineStage({ id: 's1', slaMinutes: 0 })).toThrow(/INVALID_STAGE/)
  })

  it('[FR-R141.1] rejects empty stage id', () => {
    const o = new CitizenJourneyOrchestrator()
    expect(() => o.defineStage({ id: '', slaMinutes: 10 })).toThrow(/INVALID_STAGE/)
  })

  it('[FR-R141.2] creates journey instance', () => {
    const o = setupOrchestrator(() => 1000)
    const inst = o.startJourney(CITIZEN_HASH, 'intake')
    expect(inst.status).toBe('active')
    expect(inst.currentStageId).toBe('intake')
    expect(inst.history).toHaveLength(1)
  })

  it('[FR-R141.2] rejects unknown initial stage', () => {
    const o = setupOrchestrator(() => 1000)
    expect(() => o.startJourney(CITIZEN_HASH, 'unknown')).toThrow(/UNKNOWN_STAGE/)
  })

  it('[FR-R141.2] rejects non-hex citizenHash', () => {
    const o = setupOrchestrator(() => 1000)
    expect(() => o.startJourney('invalid name', 'intake')).toThrow(/INVALID_HASH/)
  })

  it('[FR-R141.4] advances on success', () => {
    let t = 1000
    const o = setupOrchestrator(() => t)
    let inst = o.startJourney(CITIZEN_HASH, 'intake')
    t = 2000
    inst = o.advance(inst, 'success')
    expect(inst.currentStageId).toBe('review')
    expect(inst.history).toHaveLength(2)
    expect(inst.history[0]!.outcome).toBe('success')
  })

  it('[FR-R141.4] routes to rejected on failure', () => {
    const o = setupOrchestrator(() => 1000)
    let inst = o.startJourney(CITIZEN_HASH, 'intake')
    inst = o.advance(inst, 'failure')
    expect(inst.currentStageId).toBe('rejected')
  })

  it('[FR-R141.4] marks journey completed on terminal', () => {
    const o = setupOrchestrator(() => 1000)
    let inst = o.startJourney(CITIZEN_HASH, 'notify')
    inst = o.advance(inst, 'success')
    expect(inst.status).toBe('completed')
  })

  it('[FR-R141.3] detects SLA violation', () => {
    let t = 1000
    const o = setupOrchestrator(() => t)
    const inst = o.startJourney(CITIZEN_HASH, 'intake')
    // 60분 초과 (61분 경과)
    const later = 1000 + 61 * 60000
    const violations = o.checkSlaViolations([inst], later)
    expect(violations).toHaveLength(1)
    expect(violations[0]!.stageId).toBe('intake')
    expect(violations[0]!.overdueByMinutes).toBeGreaterThan(0)
  })

  it('[FR-R141.3] no violation for in-sla journey', () => {
    const o = setupOrchestrator(() => 1000)
    const inst = o.startJourney(CITIZEN_HASH, 'intake')
    const violations = o.checkSlaViolations([inst], 1000 + 30 * 60000)
    expect(violations).toHaveLength(0)
  })

  it('[FR-R141.3] ignores completed instances', () => {
    const o = setupOrchestrator(() => 1000)
    let inst = o.startJourney(CITIZEN_HASH, 'notify')
    inst = o.advance(inst, 'success')
    const violations = o.checkSlaViolations([inst], 1000 + 100 * 60000)
    expect(violations).toHaveLength(0)
  })

  it('[FR-R141.5] getAuditLog records events', () => {
    let t = 1000
    const o = setupOrchestrator(() => t)
    let inst = o.startJourney(CITIZEN_HASH, 'intake')
    t = 2000
    inst = o.advance(inst, 'success')
    const logs = o.getAuditLog()
    expect(logs.length).toBeGreaterThanOrEqual(2)
    expect(logs[0]!.event).toBe('journey.started')
    expect(logs[1]!.event).toBe('journey.advanced')
  })

  it('[FR-R141.6] blocks C-grade', () => {
    const o = setupOrchestrator(() => 1000)
    expect(() => o.startJourney(CITIZEN_HASH, 'intake', 'C')).toThrow(/BLOCKED/)
  })

  it('[FR-R141.6] blocks S-grade on advance', () => {
    const o = setupOrchestrator(() => 1000)
    const inst = o.startJourney(CITIZEN_HASH, 'intake')
    expect(() => o.advance(inst, 'success', 'S')).toThrow(/BLOCKED/)
  })
})
