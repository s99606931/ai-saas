/**
 * Unit tests — Policy Impact Analyzer AI (SVC-AI-ADV-R131 트랙B 2차)
 * Plan SC: FR-R131.1 ~ FR-R131.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PolicyImpactAnalyzerAi } from '../policy-impact-analyzer-ai'

describe('SVC-AI-ADV-R131 PolicyImpactAnalyzerAi', () => {
  let analyzer: PolicyImpactAnalyzerAi

  beforeEach(() => {
    analyzer = new PolicyImpactAnalyzerAi()
    analyzer.registerPolicy({
      policyId: 'POL-001',
      name: '민원 처리 기간 단축 정책',
      implementedDate: '2026-01-01',
    })
  })

  it('[FR-R131.3] 시행 후 개선 효과 측정 — 양의 차이', () => {
    for (let i = 0; i < 10; i++) {
      analyzer.addMetric('POL-001', 'before', 10 + i * 0.5, '2025-12-01')
      analyzer.addMetric('POL-001', 'after', 20 + i * 0.5, '2026-02-01')
    }
    const result = analyzer.analyzeEffect('POL-001')
    expect(result.difference).toBeGreaterThan(0)
    expect(result.meanAfter).toBeGreaterThan(result.meanBefore)
  })

  it('[FR-R131.3] Cohen\'s d 유의성 분류 — 큰 효과', () => {
    for (let i = 0; i < 10; i++) {
      analyzer.addMetric('POL-001', 'before', 50 + i, '2025-12-01')
      analyzer.addMetric('POL-001', 'after', 100 + i, '2026-02-01')
    }
    const result = analyzer.analyzeEffect('POL-001')
    expect(['SIGNIFICANT', 'MARGINAL']).toContain(result.significance)
  })

  it('[FR-R131.3] 데이터 없는 정책 — 기본 결과 반환', () => {
    const result = analyzer.analyzeEffect('POL-001')
    expect(result.meanBefore).toBe(0)
    expect(result.meanAfter).toBe(0)
    expect(result.significance).toBe('NONE')
  })

  it('[FR-R131.4] 보고서 생성 — Markdown 형식', () => {
    analyzer.addMetric('POL-001', 'before', 10, '2025-12-01')
    analyzer.addMetric('POL-001', 'after', 15, '2026-02-01')
    const report = analyzer.generateReport('POL-001')
    expect(report).toContain('# 정책 효과 분석 보고서')
    expect(report).toContain('민원 처리 기간 단축 정책')
  })

  it('[FR-R131.1] 미등록 정책에 지표 추가 시 에러', () => {
    expect(() => analyzer.addMetric('UNKNOWN', 'before', 10, '2025-01-01')).toThrow(
      'Unknown policy',
    )
  })

  it('[FR-R131.5] CSAP D-06 감사 로그 append-only', () => {
    analyzer.addMetric('POL-001', 'before', 10, '2025-12-01')
    analyzer.analyzeEffect('POL-001')
    const log = analyzer.getAuditLog()
    expect(log.length).toBeGreaterThan(0)
    const copy = analyzer.getAuditLog()
    copy.push({ timestamp: 'fake', action: 'injected', policyId: 'x' })
    expect(analyzer.getAuditLog().length).toBe(log.length)
  })
})
