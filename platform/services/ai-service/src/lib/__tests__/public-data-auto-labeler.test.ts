import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataAutoLabeler, type DataItem } from '../public-data-auto-labeler'

describe('PublicDataAutoLabeler', () => {
  let labeler: PublicDataAutoLabeler

  beforeEach(() => {
    labeler = new PublicDataAutoLabeler()
  })

  it('C등급 데이터 레이블링 차단', () => {
    const item: DataItem = { itemId: 'D001', title: '기밀', content: '내용', sourceOrganization: '기관', grade: 'C' }
    expect(() => labeler.label(item)).toThrow('BLOCKED')
  })

  it('S등급 데이터 레이블링 차단', () => {
    const item: DataItem = { itemId: 'D002', title: '비밀', content: '내용', sourceOrganization: '기관', grade: 'S' }
    expect(() => labeler.label(item)).toThrow('BLOCKED')
  })

  it('예산 관련 → FINANCE 레이블', () => {
    const item: DataItem = { itemId: 'D003', title: '2026년 예산 결산', content: '세금 및 재정 지출 현황', sourceOrganization: '기획재정부', grade: 'O' }
    const result = labeler.label(item)
    expect(result.category).toBe('FINANCE')
  })

  it('복지 관련 → WELFARE 레이블', () => {
    const item: DataItem = { itemId: 'D004', title: '노인 복지 지원 현황', content: '취약계층 수당 및 급여 정보', sourceOrganization: '복지부', grade: 'O' }
    const result = labeler.label(item)
    expect(result.category).toBe('WELFARE')
  })

  it('키워드 없음 → GENERAL + 검토 필요', () => {
    const item: DataItem = { itemId: 'D005', title: 'Random', content: 'no matching keywords here', sourceOrganization: '기관' }
    const result = labeler.label(item)
    expect(result.category).toBe('GENERAL')
    expect(result.requiresReview).toBe(true)
  })

  it('높은 매칭 → HIGH 신뢰도', () => {
    const item: DataItem = { itemId: 'D006', title: '예산 결산 세금 재정', content: '지출 수입 보조금', sourceOrganization: '기관', grade: 'O' }
    const result = labeler.label(item)
    expect(result.confidence).toBe('HIGH')
  })

  it('배치 레이블링', () => {
    const items: DataItem[] = [
      { itemId: 'D007', title: '예산 계획', content: '재정', sourceOrganization: '기관', grade: 'O' },
      { itemId: 'D008', title: '복지 현황', content: '노인', sourceOrganization: '기관', grade: 'O' },
    ]
    const results = labeler.labelBatch(items)
    expect(results.length).toBe(2)
  })

  it('레이블링 감사 로그', () => {
    labeler.label({ itemId: 'D009', title: '정책 제도', content: '행정 조례', sourceOrganization: '기관', grade: 'O' })
    const log = labeler.getAuditLog()
    expect(log.some((e) => e.action === 'item.label')).toBe(true)
  })
})
