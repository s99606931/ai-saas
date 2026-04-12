/**
 * AI 기반 규제 변경 영향 평가 단위 테스트 — SVC-AI-ADV-R181
 * Plan SC: FR-R181.1 ~ FR-R181.5
 */

import { describe, it, expect } from 'vitest'
import { RegulatoryImpactAssessor, DataGrade } from '../regulatory-impact-assessor'

describe('RegulatoryImpactAssessor — R181', () => {
  it('FR-R181.1: 규제 등록 및 audit log', () => {
    const ria = new RegulatoryImpactAssessor(DataGrade.O)
    ria.registerRegulation({ id: 'csap', name: 'CSAP 중등급', keywords: ['보안', '암호화', '접근제어'], complianceRequirements: ['암호화', '감사로그'] })
    const log = ria.getAuditLog()
    expect(log[0]?.action).toBe('regulationRegistered')
  })

  it('FR-R181.2: 컴포넌트 등록 및 audit log', () => {
    const ria = new RegulatoryImpactAssessor(DataGrade.O)
    ria.registerComponent({ id: 'auth', name: '인증 서비스', keywords: ['보안', '인증'], currentCapabilities: ['암호화'] })
    const log = ria.getAuditLog()
    expect(log[0]?.action).toBe('componentRegistered')
  })

  it('FR-R181.3: 규제 영향 평가 — 키워드 매핑', () => {
    const ria = new RegulatoryImpactAssessor(DataGrade.O)
    ria.registerRegulation({ id: 'reg1', name: '보안 규제', keywords: ['보안', '암호화', '접근제어'], complianceRequirements: ['암호화', '감사로그'] })
    ria.registerComponent({ id: 'c1', name: '인증 서비스', keywords: ['보안', '암호화', '인증'], currentCapabilities: ['암호화'] })
    const assessment = ria.assess('reg1')
    expect(assessment.impactedComponents.length).toBeGreaterThan(0)
    expect(assessment.impactedComponents[0]?.componentId).toBe('c1')
  })

  it('FR-R181.4: 갭 분석 — 미충족 요건 목록', () => {
    const ria = new RegulatoryImpactAssessor(DataGrade.O)
    ria.registerRegulation({
      id: 'reg1',
      name: '보안 규제',
      keywords: ['보안', '암호화', '접근제어'],
      complianceRequirements: ['암호화', '감사로그', '접근통제'],
    })
    ria.registerComponent({
      id: 'c1',
      name: '인증 서비스',
      keywords: ['보안', '암호화', '접근제어'],
      currentCapabilities: ['암호화'],
    })
    const assessment = ria.assess('reg1')
    const comp = assessment.impactedComponents[0]
    expect(comp?.gaps).toContain('감사로그')
    expect(comp?.gaps).toContain('접근통제')
  })

  it('FR-R181.5: audit log append-only', () => {
    const ria = new RegulatoryImpactAssessor(DataGrade.O)
    ria.registerRegulation({ id: 'r1', name: '규제', keywords: ['키워드'], complianceRequirements: [] })
    const log1 = ria.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    expect(ria.getAuditLog()).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new RegulatoryImpactAssessor(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new RegulatoryImpactAssessor(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 규제 id throw', () => {
    const ria = new RegulatoryImpactAssessor(DataGrade.O)
    expect(() => ria.registerRegulation({ id: '', name: '규제', keywords: [], complianceRequirements: [] }))
      .toThrow('must not be empty')
  })

  it('미등록 규제 assess throw', () => {
    const ria = new RegulatoryImpactAssessor(DataGrade.O)
    expect(() => ria.assess('unknown')).toThrow('unknown regulation')
  })
})
