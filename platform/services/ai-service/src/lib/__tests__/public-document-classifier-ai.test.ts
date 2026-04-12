/**
 * AI 기반 공공 문서 분류 자동화 단위 테스트 — SVC-AI-ADV-R185
 * Plan SC: FR-R185.1 ~ FR-R185.5
 */

import { describe, it, expect } from 'vitest'
import { PublicDocumentClassifierAI, DataGrade } from '../public-document-classifier-ai'

describe('PublicDocumentClassifierAI — R185', () => {
  it('FR-R185.1: 분류 규칙 등록 및 audit log', () => {
    const cls = new PublicDocumentClassifierAI(DataGrade.O)
    cls.registerRule({ id: 'r1', category: '보안', keywords: ['보안', '암호화'], securityLevel: 'confidential' })
    const log = cls.getAuditLog()
    expect(log[0]?.action).toBe('ruleRegistered')
  })

  it('FR-R185.2: 문서 분류 — 올바른 카테고리 반환', () => {
    const cls = new PublicDocumentClassifierAI(DataGrade.O)
    cls.registerRule({ id: 'r1', category: '보안', keywords: ['보안', '암호화', '접근제어'], securityLevel: 'confidential' })
    cls.registerRule({ id: 'r2', category: '인사', keywords: ['채용', '급여', '복지'], securityLevel: 'internal' })
    const result = cls.classify({ id: 'doc1', title: '보안 정책', content: '암호화 및 접근제어 지침' })
    expect(result.category).toBe('보안')
    expect(result.securityLevel).toBe('confidential')
  })

  it('FR-R185.3: PII 마스킹 탐지', () => {
    const cls = new PublicDocumentClassifierAI(DataGrade.O)
    cls.registerRule({ id: 'r1', category: '일반', keywords: ['일반'], securityLevel: 'public' })
    const result = cls.classify({ id: 'doc1', title: '연락처', content: '담당자 이메일: admin@gov.kr' })
    expect(result.hasPII).toBe(true)
    expect(result.maskedContent).toContain('[EMAIL]')
  })

  it('FR-R185.3: PII 없으면 hasPII=false', () => {
    const cls = new PublicDocumentClassifierAI(DataGrade.O)
    cls.registerRule({ id: 'r1', category: '일반', keywords: ['공지'], securityLevel: 'public' })
    const result = cls.classify({ id: 'doc1', title: '공지사항', content: '전체 공지합니다' })
    expect(result.hasPII).toBe(false)
  })

  it('FR-R185.4: 저신뢰도 문서 수동 검토 목록', () => {
    const cls = new PublicDocumentClassifierAI(DataGrade.O, { confidenceThreshold: 0.8 })
    cls.registerRule({ id: 'r1', category: '보안', keywords: ['보안', '암호화', '접근제어', '감사'], securityLevel: 'confidential' })
    cls.classify({ id: 'doc1', title: '기타 문서', content: '보안 관련 일부 내용' })
    const reviewList = cls.getManualReviewList()
    expect(reviewList.length).toBeGreaterThan(0)
    expect(reviewList[0]?.documentId).toBe('doc1')
  })

  it('FR-R185.5: audit log append-only', () => {
    const cls = new PublicDocumentClassifierAI(DataGrade.O)
    cls.registerRule({ id: 'r1', category: '일반', keywords: ['공지'], securityLevel: 'public' })
    const log1 = cls.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    expect(cls.getAuditLog()).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new PublicDocumentClassifierAI(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new PublicDocumentClassifierAI(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 규칙 id throw', () => {
    const cls = new PublicDocumentClassifierAI(DataGrade.O)
    expect(() => cls.registerRule({ id: '', category: '일반', keywords: ['키워드'], securityLevel: 'public' }))
      .toThrow('must not be empty')
  })

  it('키워드 없는 규칙 throw', () => {
    const cls = new PublicDocumentClassifierAI(DataGrade.O)
    expect(() => cls.registerRule({ id: 'r1', category: '일반', keywords: [], securityLevel: 'public' }))
      .toThrow('at least one keyword')
  })
})
