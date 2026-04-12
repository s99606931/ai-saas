/**
 * 문서 변경 영향 분석기 단위 테스트 — SVC-AI-ADV-R164
 * Plan SC: FR-R164.1 ~ FR-R164.5
 */

import { describe, it, expect } from 'vitest'
import { DocumentChangeImpactAnalyzer, DataGrade } from '../document-change-impact-analyzer'

describe('DocumentChangeImpactAnalyzer — R164', () => {
  it('FR-R164.1: 문서 등록 및 audit log', () => {
    const dcia = new DocumentChangeImpactAnalyzer(DataGrade.O)
    dcia.registerDocument({ id: 'doc1', title: '개인정보처리방침', keywords: ['개인정보', '수집'], referencedDocIds: [] })
    const log = dcia.getAuditLog()
    expect(log[0]?.action).toBe('documentRegistered')
    expect(log[0]?.details.id).toBe('doc1')
  })

  it('FR-R164.2: 키워드 기반 자동 추론 의존성 탐지', () => {
    const dcia = new DocumentChangeImpactAnalyzer(DataGrade.O)
    dcia.registerDocument({ id: 'policy', title: '보안 정책', keywords: ['보안', '접근제어', '암호화', '감사'], referencedDocIds: [] })
    dcia.registerDocument({ id: 'procedure', title: '보안 절차', keywords: ['보안', '접근제어', '암호화', '인증'], referencedDocIds: [] })
    const report = dcia.analyzeImpact('policy')
    // Jaccard >= 0.2: procedure shares 3/5 keywords with policy
    expect(report.directImpact.some((d) => d.id === 'procedure')).toBe(true)
  })

  it('FR-R164.3: 직접 참조 의존성 탐지', () => {
    const dcia = new DocumentChangeImpactAnalyzer(DataGrade.O)
    dcia.registerDocument({ id: 'parent', title: '상위 문서', keywords: ['정책'], referencedDocIds: [] })
    dcia.registerDocument({ id: 'child', title: '하위 문서', keywords: ['절차'], referencedDocIds: ['parent'] })
    const report = dcia.analyzeImpact('parent')
    expect(report.directImpact.some((d) => d.id === 'child')).toBe(true)
  })

  it('FR-R164.3: 전이 영향 탐지 (distance=2)', () => {
    const dcia = new DocumentChangeImpactAnalyzer(DataGrade.O)
    dcia.registerDocument({ id: 'root', title: '루트', keywords: ['정책'], referencedDocIds: [] })
    dcia.registerDocument({ id: 'mid', title: '중간', keywords: ['규정'], referencedDocIds: ['root'] })
    dcia.registerDocument({ id: 'leaf', title: '말단', keywords: ['절차'], referencedDocIds: ['mid'] })
    const report = dcia.analyzeImpact('root')
    expect(report.transitiveImpact.some((d) => d.id === 'leaf')).toBe(true)
    expect(report.totalImpacted).toBeGreaterThanOrEqual(2)
  })

  it('FR-R164.4: severity=high — distance=1 + shared>=3', () => {
    const dcia = new DocumentChangeImpactAnalyzer(DataGrade.O)
    dcia.registerDocument({ id: 'src', title: '원본', keywords: ['a', 'b', 'c', 'd'], referencedDocIds: [] })
    dcia.registerDocument({ id: 'dep', title: '의존', keywords: ['a', 'b', 'c', 'e'], referencedDocIds: ['src'] })
    const report = dcia.analyzeImpact('src')
    const depImpact = report.directImpact.find((d) => d.id === 'dep')
    expect(depImpact?.severity).toBe('high')
    expect(report.reviewRequired).toContain('dep')
  })

  it('FR-R164.5: audit log append-only', () => {
    const dcia = new DocumentChangeImpactAnalyzer(DataGrade.O)
    dcia.registerDocument({ id: 'doc1', title: '정책', keywords: ['정책'], referencedDocIds: [] })
    const log1 = dcia.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    const log2 = dcia.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new DocumentChangeImpactAnalyzer(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new DocumentChangeImpactAnalyzer(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 id 등록 throw', () => {
    const dcia = new DocumentChangeImpactAnalyzer(DataGrade.O)
    expect(() => dcia.registerDocument({ id: '', title: '제목', keywords: [], referencedDocIds: [] }))
      .toThrow('must not be empty')
  })

  it('미등록 문서 analyzeImpact throw', () => {
    const dcia = new DocumentChangeImpactAnalyzer(DataGrade.O)
    expect(() => dcia.analyzeImpact('nonexistent')).toThrow('unknown document')
  })
})
