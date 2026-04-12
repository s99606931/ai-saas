/**
 * 재해 복구 자동화 AI 단위 테스트 — SVC-AI-ADV-R160
 * Plan SC: FR-R160.1 ~ FR-R160.6
 */

import { describe, it, expect } from 'vitest'
import { DisasterRecoveryAI, DataGrade } from '../disaster-recovery-ai'

describe('DisasterRecoveryAI — R160', () => {
  it('FR-R160.1: 서비스 등록 및 audit log', () => {
    const dr = new DisasterRecoveryAI(DataGrade.O)
    dr.registerService({ id: 'db', rtoMinutes: 60, rpoMinutes: 15, dependencies: [], priority: 10, recoveryTimeMinutes: 30 })
    const log = dr.getAuditLog()
    expect(log[0]?.action).toBe('serviceRegistered')
    expect(log[0]?.details.id).toBe('db')
  })

  it('FR-R160.3: 복구 계획 생성 — 단계 및 순서', () => {
    const dr = new DisasterRecoveryAI(DataGrade.O)
    dr.registerService({ id: 'db', rtoMinutes: 120, rpoMinutes: 30, dependencies: [], priority: 10, recoveryTimeMinutes: 20 })
    dr.registerService({ id: 'app', rtoMinutes: 120, rpoMinutes: 30, dependencies: ['db'], priority: 8, recoveryTimeMinutes: 10 })
    const plan = dr.generatePlan({ id: 'sc1', affectedServices: ['db', 'app'], severity: 'partial' })
    expect(plan.steps).toHaveLength(2)
    expect(plan.steps[0]?.serviceId).toBe('db') // db must come before app
    expect(plan.steps[1]?.serviceId).toBe('app')
  })

  it('FR-R160.4: RTO 충족 여부 판단', () => {
    const dr = new DisasterRecoveryAI(DataGrade.O)
    dr.registerService({ id: 'svc', rtoMinutes: 10, rpoMinutes: 5, dependencies: [], priority: 5, recoveryTimeMinutes: 20 })
    const plan = dr.generatePlan({ id: 'sc1', affectedServices: ['svc'], severity: 'full' })
    expect(plan.steps[0]?.rtoMet).toBe(false)
    expect(plan.warnings.length).toBeGreaterThan(0)
  })

  it('FR-R160.5: RPO — partial severity 시 allRpoMet=true', () => {
    const dr = new DisasterRecoveryAI(DataGrade.O)
    dr.registerService({ id: 'svc', rtoMinutes: 60, rpoMinutes: 30, dependencies: [], priority: 5, recoveryTimeMinutes: 10 })
    const partial = dr.generatePlan({ id: 'sc1', affectedServices: ['svc'], severity: 'partial' })
    expect(partial.allRpoMet).toBe(true)
    const full = dr.generatePlan({ id: 'sc2', affectedServices: ['svc'], severity: 'full' })
    expect(full.allRpoMet).toBe(false)
  })

  it('영향 없는 시나리오 — steps 없음 + warning', () => {
    const dr = new DisasterRecoveryAI(DataGrade.O)
    const plan = dr.generatePlan({ id: 'empty', affectedServices: ['unknown'], severity: 'partial' })
    expect(plan.steps).toHaveLength(0)
    expect(plan.warnings).toContain('영향받는 서비스 없음')
  })

  it('FR-R160.6: audit log append-only', () => {
    const dr = new DisasterRecoveryAI(DataGrade.O)
    dr.registerService({ id: 'db', rtoMinutes: 60, rpoMinutes: 15, dependencies: [], priority: 10, recoveryTimeMinutes: 30 })
    const log1 = dr.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    const log2 = dr.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new DisasterRecoveryAI(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new DisasterRecoveryAI(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 id 등록 throw', () => {
    const dr = new DisasterRecoveryAI(DataGrade.O)
    expect(() => dr.registerService({ id: '', rtoMinutes: 60, rpoMinutes: 15, dependencies: [], priority: 5, recoveryTimeMinutes: 10 }))
      .toThrow('must not be empty')
  })

  it('rtoMinutes <= 0 throw', () => {
    const dr = new DisasterRecoveryAI(DataGrade.O)
    expect(() => dr.registerService({ id: 'svc', rtoMinutes: 0, rpoMinutes: 15, dependencies: [], priority: 5, recoveryTimeMinutes: 10 }))
      .toThrow('rtoMinutes must be > 0')
  })
})
