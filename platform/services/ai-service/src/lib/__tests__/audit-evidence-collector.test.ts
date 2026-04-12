/**
 * Unit tests — Audit Evidence Collector (SVC-AI-ADV-R136 트랙B 2차)
 * Plan SC: FR-R136.1 ~ FR-R136.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AuditEvidenceCollector } from '../audit-evidence-collector'

describe('SVC-AI-ADV-R136 AuditEvidenceCollector', () => {
  let collector: AuditEvidenceCollector

  beforeEach(() => {
    collector = new AuditEvidenceCollector()
  })

  it('[FR-R136.1] 증적 등록 후 갭 분석에 반영됨', () => {
    collector.registerEvidence({
      evidenceId: 'EV-001',
      title: '감사 로그 스크린샷',
      type: 'screenshot',
      collectedAt: '2026-04-12',
    })
    collector.mapToCsap('EV-001', 'D-06-01')
    const gaps = collector.analyzeGaps()
    const satisfied = gaps.find((g) => g.itemId === 'D-06-01')
    expect(satisfied).toBeUndefined()
  })

  it('[FR-R136.3] 매핑 없는 CSAP 항목 갭으로 반환', () => {
    const gaps = collector.analyzeGaps()
    expect(gaps.length).toBeGreaterThan(0)
    const d0601 = gaps.find((g) => g.itemId === 'D-06-01')
    expect(d0601).toBeDefined()
  })

  it('[FR-R136.4] 충족률 계산 — 일부 충족', () => {
    collector.registerEvidence({
      evidenceId: 'EV-002',
      title: 'RBAC 설정 문서',
      type: 'document',
      collectedAt: '2026-04-12',
    })
    collector.mapToCsap('EV-002', 'D-08-01')
    const report = collector.getComplianceReport()
    expect(report.satisfactionRate).toBeGreaterThan(0)
    expect(report.satisfactionRate).toBeLessThan(1)
    expect(report.satisfiedItems).toBeGreaterThan(0)
  })

  it('[FR-R136.2] 미등록 증적 매핑 시 에러', () => {
    expect(() => collector.mapToCsap('UNKNOWN-EV', 'D-06-01')).toThrow('Unknown evidence')
  })

  it('[FR-R136.4] 전체 충족 시 satisfactionRate=1', () => {
    const csapItems = ['D-06-01', 'D-06-02', 'D-06-03', 'D-08-01', 'D-08-02',
      'D-08-03', 'D-09-01', 'D-09-02', 'D-09-03', 'D-12-01', 'D-12-02', 'D-12-03']
    for (let i = 0; i < csapItems.length; i++) {
      collector.registerEvidence({
        evidenceId: `EV-${i}`, title: `증적 ${i}`, type: 'doc', collectedAt: '2026-04-12',
      })
      collector.mapToCsap(`EV-${i}`, csapItems[i]!)
    }
    const report = collector.getComplianceReport()
    expect(report.satisfactionRate).toBe(1)
    expect(report.gaps).toHaveLength(0)
  })

  it('[FR-R136.5] CSAP D-06 감사 로그 append-only', () => {
    collector.registerEvidence({ evidenceId: 'EV-X', title: 'X', type: 'doc', collectedAt: '2026-04-12' })
    collector.analyzeGaps()
    const log = collector.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
    const copy = collector.getAuditLog()
    copy.push({ timestamp: 'fake', action: 'injected', detail: {} })
    expect(collector.getAuditLog().length).toBe(log.length)
  })
})
