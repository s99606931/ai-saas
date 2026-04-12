/**
 * Tests — SVC-AI-ADV-R122 Compliance Report Generator
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ComplianceReportGenerator,
  DataGrade,
} from '../compliance-report-generator'

describe('ComplianceReportGenerator — R122', () => {
  let gen: ComplianceReportGenerator

  beforeEach(() => {
    gen = new ComplianceReportGenerator()
    gen.registerControl({
      id: 'CSAP-D-06',
      framework: 'CSAP',
      description: '감사 로그 기록',
      required: true,
    })
    gen.registerControl({
      id: 'CSAP-D-08',
      framework: 'CSAP',
      description: '접근 통제',
      required: true,
    })
    gen.registerControl({
      id: 'CSAP-D-09',
      framework: 'CSAP',
      description: '암호화',
      required: true,
    })
    gen.registerControl({
      id: 'N2SF-N-05',
      framework: 'N2SF',
      description: 'AI API 등급 차단',
      required: true,
    })
    gen.registerControl({
      id: 'MOIS-T-01',
      framework: 'MOIS',
      description: '사업계획서',
      required: true,
    })
    gen.registerControl({
      id: 'CSAP-OPT',
      framework: 'CSAP',
      description: '선택 항목',
      required: false,
    })
  })

  it('FR-R122.1: 통제항목 등록', () => {
    expect(gen.listControls().length).toBe(6)
  })

  it('FR-R122.3: 상태 갱신', () => {
    gen.setStatus('CSAP-D-06', 'compliant', '감사 모듈 완비')
    const record = gen
      .listControls()
      .find((r) => r.control.id === 'CSAP-D-06')
    expect(record?.status).toBe('compliant')
    expect(record?.note).toBe('감사 모듈 완비')
  })

  it('알 수 없는 통제항목 상태 갱신 시 throw', () => {
    expect(() => gen.setStatus('UNKNOWN', 'compliant')).toThrow(
      'Unknown control',
    )
  })

  it('FR-R122.2: 증적 등록', () => {
    gen.addEvidence({
      controlId: 'CSAP-D-06',
      path: 'src/lib/audit.ts',
      description: '감사 로그 모듈',
      addedAt: '2026-04-12',
      grade: DataGrade.O,
    })
    const record = gen
      .listControls()
      .find((r) => r.control.id === 'CSAP-D-06')
    expect(record?.evidences.length).toBe(1)
  })

  it('FR-R122.7: C등급 증적 차단', () => {
    expect(() =>
      gen.addEvidence({
        controlId: 'CSAP-D-06',
        path: 'x',
        description: 'y',
        addedAt: '2026-04-12',
        grade: DataGrade.C,
      }),
    ).toThrow('BLOCKED')
  })

  it('FR-R122.7: S등급 증적 차단', () => {
    expect(() =>
      gen.addEvidence({
        controlId: 'CSAP-D-06',
        path: 'x',
        description: 'y',
        addedAt: '2026-04-12',
        grade: DataGrade.S,
      }),
    ).toThrow('N2SF N-05')
  })

  it('FR-R122.4: 프레임워크별 커버리지 계산', () => {
    gen.setStatus('CSAP-D-06', 'compliant')
    gen.setStatus('CSAP-D-08', 'compliant')
    gen.setStatus('CSAP-D-09', 'partial')
    gen.setStatus('N2SF-N-05', 'compliant')
    gen.setStatus('MOIS-T-01', 'non-compliant')

    const summary = gen.getSummary()
    const csap = summary.frameworks.find((f) => f.framework === 'CSAP')
    expect(csap?.totalRequired).toBe(3)
    expect(csap?.compliant).toBe(2)
    expect(csap?.partial).toBe(1)
    expect(csap?.coverageRate).toBeCloseTo(2 / 3, 3)

    const n2sf = summary.frameworks.find((f) => f.framework === 'N2SF')
    expect(n2sf?.coverageRate).toBe(1)

    const mois = summary.frameworks.find((f) => f.framework === 'MOIS')
    expect(mois?.coverageRate).toBe(0)
  })

  it('FR-R122.6: 미흡 항목 리스트', () => {
    gen.setStatus('CSAP-D-06', 'compliant')
    gen.setStatus('CSAP-D-09', 'partial')
    gen.setStatus('MOIS-T-01', 'non-compliant')
    const summary = gen.getSummary()
    expect(summary.missing).toContain('CSAP-D-09')
    expect(summary.missing).toContain('MOIS-T-01')
    expect(summary.missing).not.toContain('CSAP-D-06')
  })

  it('FR-R122.5: Markdown 리포트 렌더링', () => {
    gen.setStatus('CSAP-D-06', 'compliant')
    gen.addEvidence({
      controlId: 'CSAP-D-06',
      path: 'src/lib/audit.ts',
      description: '감사 모듈',
      addedAt: '2026-04-12',
      grade: DataGrade.O,
    })
    const md = gen.renderMarkdown({ title: '2026 Q2 감리 리포트' })
    expect(md).toContain('# 2026 Q2 감리 리포트')
    expect(md).toContain('프레임워크별 커버리지')
    expect(md).toContain('CSAP-D-06')
    expect(md).toContain('src/lib/audit.ts')
  })

  it('not-applicable 상태 처리', () => {
    gen.setStatus('CSAP-D-06', 'compliant')
    gen.setStatus('CSAP-D-08', 'not-applicable')
    gen.setStatus('CSAP-D-09', 'compliant')
    const summary = gen.getSummary()
    const csap = summary.frameworks.find((f) => f.framework === 'CSAP')
    // not-applicable은 listControls 전체 기준으로 집계
    expect((csap?.notApplicable ?? 0)).toBeGreaterThanOrEqual(1)
    // 필수 3개 중 compliant 2개 → 2/3
    expect(csap?.coverageRate).toBeCloseTo(2 / 3, 3)
  })

  it('FR-R122.8: 감사 로그 기록', () => {
    gen.setStatus('CSAP-D-06', 'compliant')
    gen.addEvidence({
      controlId: 'CSAP-D-06',
      path: 'x',
      description: 'y',
      addedAt: '2026-04-12',
      grade: DataGrade.O,
    })
    gen.getSummary()
    gen.renderMarkdown()
    const log = gen.getAuditLog()
    expect(log.some((e) => e.action === 'registerControl')).toBe(true)
    expect(log.some((e) => e.action === 'setStatus')).toBe(true)
    expect(log.some((e) => e.action === 'addEvidence')).toBe(true)
    expect(log.some((e) => e.action === 'generateSummary')).toBe(true)
    expect(log.some((e) => e.action === 'renderMarkdown')).toBe(true)
  })

  it('미흡 항목 없을 때 Markdown에 "없음" 표시', () => {
    gen.setStatus('CSAP-D-06', 'compliant')
    gen.setStatus('CSAP-D-08', 'compliant')
    gen.setStatus('CSAP-D-09', 'compliant')
    gen.setStatus('N2SF-N-05', 'compliant')
    gen.setStatus('MOIS-T-01', 'compliant')
    const md = gen.renderMarkdown()
    expect(md).toContain('미흡 항목 없음')
  })
})
