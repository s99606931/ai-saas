import { describe, it, expect, beforeEach } from 'vitest'
import { ComplaintAutoRouter } from '../complaint-auto-router'

describe('ComplaintAutoRouter', () => {
  let router: ComplaintAutoRouter

  beforeEach(() => {
    router = new ComplaintAutoRouter()
    router.registerCategory({ categoryId: 'CAT-1', name: '도로', keywords: ['도로', '포장', '파손', '보수'], department: '도로관리과' })
    router.registerCategory({ categoryId: 'CAT-2', name: '쓰레기', keywords: ['쓰레기', '청소', '환경', '악취'], department: '환경위생과' })
  })

  it('N2SF C등급 민원 차단', () => {
    expect(() => router.classify({ complaintId: 'CM-1', title: '민원', body: '내용', grade: 'C' })).toThrow('BLOCKED')
  })

  it('키워드 매칭으로 카테고리 분류', () => {
    const result = router.classify({ complaintId: 'CM-2', title: '도로 파손', body: '도로가 파손되었습니다 보수 요청' })
    expect(result.categoryId).toBe('CAT-1')
    expect(result.department).toBe('도로관리과')
  })

  it('긴급 키워드 포함 시 URGENT 우선순위', () => {
    const result = router.classify({ complaintId: 'CM-3', title: '긴급 도로 파손', body: '긴급 조치 필요합니다 도로 위험' })
    expect(result.priority).toBe('URGENT')
  })

  it('높은 confidence 시 HIGH 우선순위', () => {
    const result = router.classify({ complaintId: 'CM-4', title: '쓰레기 청소 환경 악취', body: '쓰레기 청소 환경 악취' })
    expect(result.priority).toBe('HIGH')
    expect(result.confidence).toBeGreaterThanOrEqual(0.5)
  })

  it('매칭 카테고리 없으면 UNKNOWN 부서', () => {
    const result = router.classify({ complaintId: 'CM-5', title: '전혀 무관한 민원', body: '내용 없음' })
    expect(result.categoryId).toBe('UNKNOWN')
    expect(result.department).toBe('미분류')
  })

  it('감사 로그 복사본 반환', () => {
    router.classify({ complaintId: 'CM-6', title: '도로', body: '도로 파손' })
    const log = router.getAuditLog()
    log.push({ timestamp: '', action: 'injected', complaintId: 'X', detail: {} })
    expect(router.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
