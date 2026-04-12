/**
 * Unit tests — CSAP Renewal Manager (SVC-AI-ADV-R137 트랙B 2차)
 * Plan SC: FR-R137.1 ~ FR-R137.6
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CsapRenewalManager } from '../csap-renewal-manager'

describe('SVC-AI-ADV-R137 CsapRenewalManager', () => {
  let manager: CsapRenewalManager

  beforeEach(() => {
    manager = new CsapRenewalManager()
    manager.registerRenewal({
      renewalId: 'REN-001',
      systemName: '공공 SaaS 플랫폼',
      expiryDate: '2026-07-01',
      grade: 'STANDARD',
    })
  })

  it('[FR-R137.2] STANDARD 등급 체크리스트 20개 생성', () => {
    const items = manager.generateChecklist('REN-001')
    expect(items).toHaveLength(20)
    expect(items[0]!.done).toBe(false)
    expect(items[0]!.renewalId).toBe('REN-001')
  })

  it('[FR-R137.2] HIGH 등급 체크리스트 30개 생성', () => {
    manager.registerRenewal({
      renewalId: 'REN-HIGH',
      systemName: '고등급 시스템',
      expiryDate: '2026-07-01',
      grade: 'HIGH',
    })
    const items = manager.generateChecklist('REN-HIGH')
    expect(items).toHaveLength(30)
  })

  it('[FR-R137.3] 항목 완료 처리', () => {
    const items = manager.generateChecklist('REN-001')
    const updated = manager.updateCheckItem('REN-001', items[0]!.itemId, true)
    expect(updated.done).toBe(true)
  })

  it('[FR-R137.4] 완료율 계산', () => {
    const items = manager.generateChecklist('REN-001')
    manager.updateCheckItem('REN-001', items[0]!.itemId, true)
    manager.updateCheckItem('REN-001', items[1]!.itemId, true)
    const progress = manager.getProgress('REN-001')
    expect(progress.doneItems).toBe(2)
    expect(progress.completionRate).toBeCloseTo(2 / 20)
  })

  it('[FR-R137.5] D-day 이내 갱신 알림 반환', () => {
    const now = new Date('2026-06-01')
    const alerts = manager.getDueAlerts(60, now) // 60일 이내
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.renewalId).toBe('REN-001')
  })

  it('[FR-R137.5] D-day 초과 시 알림 없음', () => {
    const now = new Date('2026-01-01')
    const alerts = manager.getDueAlerts(30, now) // 30일 이내 — 7월 만료는 포함 안됨
    expect(alerts).toHaveLength(0)
  })

  it('[FR-R137.6] CSAP D-06 감사 로그 append-only', () => {
    manager.generateChecklist('REN-001')
    manager.getProgress('REN-001')
    const log = manager.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
    const copy = manager.getAuditLog()
    copy.push({ timestamp: 'fake', action: 'injected', renewalId: 'x', detail: {} })
    expect(manager.getAuditLog().length).toBe(log.length)
  })
})
