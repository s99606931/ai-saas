/**
 * AI 기반 지식 관리 자동화 단위 테스트 — SVC-AI-ADV-R180
 * Plan SC: FR-R180.1 ~ FR-R180.5
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeManagementAI, DataGrade } from '../knowledge-management-ai'

describe('KnowledgeManagementAI — R180', () => {
  it('FR-R180.1: 문서 등록 및 audit log', () => {
    const km = new KnowledgeManagementAI(DataGrade.O)
    km.registerDocument({ id: 'doc1', title: '보안 정책', content: '보안 관련 정책 문서', category: '보안', keywords: ['보안', '정책'] })
    const log = km.getAuditLog()
    expect(log[0]?.action).toBe('documentRegistered')
  })

  it('FR-R180.1: PII 마스킹 — 등록 시 이메일 마스킹', () => {
    const km = new KnowledgeManagementAI(DataGrade.O)
    km.registerDocument({ id: 'd1', title: '연락처', content: '담당자 admin@gov.kr 문의', category: '일반', keywords: ['연락처'] })
    const result = km.search('연락처')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]?.doc.content).not.toContain('admin@gov.kr')
    expect(result[0]?.doc.content).toContain('[EMAIL]')
  })

  it('FR-R180.2: 중복 문서 탐지', () => {
    const km = new KnowledgeManagementAI(DataGrade.O)
    km.registerDocument({ id: 'd1', title: '보안 정책 A', content: '내용', category: '보안', keywords: ['보안', '정책', '접근제어', '암호화'] })
    km.registerDocument({ id: 'd2', title: '보안 정책 B', content: '내용', category: '보안', keywords: ['보안', '정책', '접근제어', '인증'] })
    km.registerDocument({ id: 'd3', title: '인사 규정', content: '내용', category: '인사', keywords: ['채용', '급여', '복지'] })
    const groups = km.findDuplicates(0.5)
    expect(groups.length).toBeGreaterThan(0)
    const dup = groups.find((g) => g.docIds.includes('d1') && g.docIds.includes('d2'))
    expect(dup).toBeDefined()
  })

  it('FR-R180.3: 키워드 기반 검색', () => {
    const km = new KnowledgeManagementAI(DataGrade.O)
    km.registerDocument({ id: 'd1', title: '보안 정책', content: '접근 제어 관련', category: '보안', keywords: ['보안', '정책'] })
    km.registerDocument({ id: 'd2', title: '인사 규정', content: '채용 관련', category: '인사', keywords: ['채용', '급여'] })
    const results = km.search('보안 정책')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.doc.id).toBe('d1')
  })

  it('FR-R180.4: 카테고리 통계', () => {
    const km = new KnowledgeManagementAI(DataGrade.O)
    km.registerDocument({ id: 'd1', title: '문서1', content: '내용', category: '보안', keywords: ['보안'] })
    km.registerDocument({ id: 'd2', title: '문서2', content: '내용', category: '보안', keywords: ['정책'] })
    km.registerDocument({ id: 'd3', title: '문서3', content: '내용', category: '인사', keywords: ['채용'] })
    const stats = km.getCategoryStats()
    const sec = stats.find((s) => s.category === '보안')
    expect(sec?.count).toBe(2)
  })

  it('FR-R180.5: audit log append-only', () => {
    const km = new KnowledgeManagementAI(DataGrade.O)
    km.registerDocument({ id: 'd1', title: '문서', content: '내용', category: '일반', keywords: [] })
    const log1 = km.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    expect(km.getAuditLog()).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new KnowledgeManagementAI(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new KnowledgeManagementAI(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 id 등록 throw', () => {
    const km = new KnowledgeManagementAI(DataGrade.O)
    expect(() => km.registerDocument({ id: '', title: '제목', content: '내용', category: '일반', keywords: [] }))
      .toThrow('must not be empty')
  })
})
