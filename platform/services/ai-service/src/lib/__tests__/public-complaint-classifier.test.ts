/**
 * Unit tests — Public Complaint Classifier (SVC-AI-ADV-R109 트랙B)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R109-complaint.design.md
 * Plan SC: FR-R109-C.1 ~ FR-R109-C.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PublicComplaintClassifier } from '../public-complaint-classifier'

describe('SVC-AI-ADV-R109 PublicComplaintClassifier', () => {
  let classifier: PublicComplaintClassifier

  beforeEach(() => {
    classifier = new PublicComplaintClassifier()
    classifier.registerCategory({
      categoryId: 'CAT-001',
      name: '도로/교통',
      keywords: ['도로', '신호등', '교통', '포트홀', '차도'],
      defaultPriority: 'HIGH',
    })
    classifier.registerCategory({
      categoryId: 'CAT-002',
      name: '환경/쓰레기',
      keywords: ['쓰레기', '환경', '냄새', '불법투기'],
      defaultPriority: 'MEDIUM',
    })
    classifier.registerDepartment({
      departmentId: 'DEPT-001',
      name: '도로교통과',
      categories: ['CAT-001'],
    })
    classifier.registerDepartment({
      departmentId: 'DEPT-002',
      name: '환경과',
      categories: ['CAT-002'],
    })
  })

  it('[FR-R109-C.3] 도로 관련 민원 정확히 분류됨', () => {
    const result = classifier.classify('우리 동네 도로에 포트홀이 심각합니다', 'O')
    expect(result.categoryId).toBe('CAT-001')
    expect(result.unclassified).toBe(false)
    expect(result.score).toBeGreaterThan(0)
  })

  it('[FR-R109-C.3] N2SF C 등급 입력 차단', () => {
    expect(() => classifier.classify('비공개 민원 내용', 'C')).toThrow('BLOCKED')
    expect(() => classifier.classify('기밀 정보 포함', 'S')).toThrow('BLOCKED')
  })

  it('[FR-R109-C.3] PII 마스킹 — 주민번호 치환', () => {
    const result = classifier.classify('신청인: 890101-1234567 도로 문제', 'O')
    expect(result.maskedText).not.toContain('890101-1234567')
    expect(result.maskedText).toContain('######-#######')
  })

  it('[FR-R109-C.3] PII 마스킹 — 전화번호 치환', () => {
    const result = classifier.classify('연락처 010-1234-5678 교통 민원', 'O')
    expect(result.maskedText).not.toContain('010-1234-5678')
    expect(result.maskedText).toContain('010-****-####')
  })

  it('[FR-R109-C.3] 분류 불가 민원 unclassified=true', () => {
    const result = classifier.classify('관련 없는 내용입니다 aabbcc', 'O')
    expect(result.unclassified).toBe(true)
    expect(result.categoryId).toBeNull()
  })

  it('[FR-R109-C.4] 분류 결과로 담당 부서 배분', () => {
    const classification = classifier.classify('교통 신호등이 고장났습니다', 'O')
    const routing = classifier.route(classification)
    expect(routing.departmentId).toBe('DEPT-001')
    expect(routing.departmentName).toBe('도로교통과')
  })

  it('[FR-R109-C.4] 미분류 민원 부서 배분 없음', () => {
    const classification = classifier.classify('무관한 민원 내용입니다', 'O')
    const routing = classifier.route(classification)
    expect(routing.departmentId).toBeNull()
  })

  it('[FR-R109-C.5] CSAP D-06 감사 로그 기록됨', () => {
    classifier.classify('도로 민원입니다', 'O')
    const log = classifier.getAuditLog()
    expect(log.length).toBeGreaterThan(0)
    expect(log[0]!.action).toBe('complaint.classify')
    expect(log[0]!.grade).toBe('O')
  })
})
