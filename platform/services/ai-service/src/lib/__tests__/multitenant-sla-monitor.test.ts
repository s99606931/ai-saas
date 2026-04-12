/**
 * AI 기반 멀티테넌트 SLA 모니터링 단위 테스트 — SVC-AI-ADV-R187
 * Plan SC: FR-R187.1 ~ FR-R187.5
 */

import { describe, it, expect } from 'vitest'
import { MultitenantSLAMonitor, DataGrade } from '../multitenant-sla-monitor'

const tenantA = { tenantId: 'tenantA', tenantName: '기관 A', maxResponseTimeMs: 500, minAvailabilityPercent: 99 }

describe('MultitenantSLAMonitor — R187', () => {
  it('FR-R187.1: 테넌트 등록 및 audit log', () => {
    const mon = new MultitenantSLAMonitor(DataGrade.O)
    mon.registerTenant(tenantA)
    const log = mon.getAuditLog()
    expect(log[0]?.action).toBe('tenantRegistered')
    expect(log[0]?.details.tenantId).toBe('tenantA')
  })

  it('FR-R187.2: 메트릭 기록 및 audit log', () => {
    const mon = new MultitenantSLAMonitor(DataGrade.O)
    mon.registerTenant(tenantA)
    mon.recordMetric({ tenantId: 'tenantA', requestId: 'r1', responseTimeMs: 200, success: true, timestamp: Date.now() })
    const log = mon.getAuditLog()
    expect(log.some((e) => e.action === 'metricRecorded')).toBe(true)
  })

  it('FR-R187.3: 응답시간 위반 탐지', () => {
    const mon = new MultitenantSLAMonitor(DataGrade.O)
    mon.registerTenant(tenantA)
    mon.recordMetric({ tenantId: 'tenantA', requestId: 'r1', responseTimeMs: 600, success: true, timestamp: Date.now() })
    const violations = mon.checkViolations('tenantA')
    expect(violations.some((v) => v.type === 'response_time')).toBe(true)
    expect(violations[0]?.actual).toBe(600)
  })

  it('FR-R187.3: 가용성 위반 탐지', () => {
    const mon = new MultitenantSLAMonitor(DataGrade.O)
    mon.registerTenant({ ...tenantA, minAvailabilityPercent: 99 })
    // 10개 요청 중 2개만 성공 → 가용성 20%
    for (let i = 0; i < 8; i++) {
      mon.recordMetric({ tenantId: 'tenantA', requestId: `r${i}`, responseTimeMs: 200, success: false, timestamp: i * 100 })
    }
    for (let i = 8; i < 10; i++) {
      mon.recordMetric({ tenantId: 'tenantA', requestId: `r${i}`, responseTimeMs: 200, success: true, timestamp: i * 100 })
    }
    const violations = mon.checkViolations('tenantA')
    expect(violations.some((v) => v.type === 'availability')).toBe(true)
  })

  it('FR-R187.4: SLA 준수 리포트 생성', () => {
    const mon = new MultitenantSLAMonitor(DataGrade.O)
    mon.registerTenant(tenantA)
    for (let i = 0; i < 5; i++) {
      mon.recordMetric({ tenantId: 'tenantA', requestId: `r${i}`, responseTimeMs: 100, success: true, timestamp: i * 100 })
    }
    const report = mon.getReport('tenantA')
    expect(report.tenantName).toBe('기관 A')
    expect(report.totalRequests).toBe(5)
    expect(report.slaMetStatus).toBe(true)
    expect(report.availabilityPercent).toBe(100)
  })

  it('FR-R187.5: audit log append-only', () => {
    const mon = new MultitenantSLAMonitor(DataGrade.O)
    mon.registerTenant(tenantA)
    const log1 = mon.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    expect(mon.getAuditLog()).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new MultitenantSLAMonitor(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new MultitenantSLAMonitor(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 tenantId throw', () => {
    const mon = new MultitenantSLAMonitor(DataGrade.O)
    expect(() => mon.registerTenant({ ...tenantA, tenantId: '' })).toThrow('must not be empty')
  })

  it('미등록 테넌트 메트릭 기록 throw', () => {
    const mon = new MultitenantSLAMonitor(DataGrade.O)
    expect(() => mon.recordMetric({ tenantId: 'unknown', requestId: 'r1', responseTimeMs: 100, success: true, timestamp: 0 }))
      .toThrow('unknown tenant')
  })
})
