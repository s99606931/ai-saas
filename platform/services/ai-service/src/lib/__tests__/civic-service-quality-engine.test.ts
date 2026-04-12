import { describe, it, expect, beforeEach } from 'vitest'
import { CivicServiceQualityEngine } from '../civic-service-quality-engine'

describe('CivicServiceQualityEngine', () => {
  let engine: CivicServiceQualityEngine

  beforeEach(() => {
    engine = new CivicServiceQualityEngine()
    // 부서 A — 우수 민원 1건
    engine.recordRequest(
      {
        requestId: 'r-1',
        departmentId: 'dept-A',
        citizenId: 'citizen-001-private',
        submittedAt: '2026-04-10T10:00:00Z',
        respondedAt: '2026-04-10T12:00:00Z', // 2시간
        resolvedAt: '2026-04-10T15:00:00Z',
        reinquiryCount: 0,
        satisfaction: 5,
      },
      'admin-1',
      'O'
    )
  })

  it('C등급 차단', () => {
    expect(() =>
      engine.recordRequest(
        {
          requestId: 'x',
          departmentId: 'd',
          citizenId: 'c',
          submittedAt: 'now',
          reinquiryCount: 0,
        },
        'a',
        'C'
      )
    ).toThrow('BLOCKED')
  })

  it('reinquiryCount 음수 차단', () => {
    expect(() =>
      engine.recordRequest(
        {
          requestId: 'x',
          departmentId: 'd',
          citizenId: 'c',
          submittedAt: 'now',
          reinquiryCount: -1,
        },
        'a',
        'O'
      )
    ).toThrow('reinquiryCount')
  })

  it('satisfaction 범위 검증', () => {
    expect(() =>
      engine.recordRequest(
        {
          requestId: 'x',
          departmentId: 'd',
          citizenId: 'c',
          submittedAt: 'now',
          reinquiryCount: 0,
          satisfaction: 6,
        },
        'a',
        'O'
      )
    ).toThrow('satisfaction')
  })

  it('중복 request 차단', () => {
    expect(() =>
      engine.recordRequest(
        {
          requestId: 'r-1',
          departmentId: 'd',
          citizenId: 'c',
          submittedAt: 'now',
          reinquiryCount: 0,
        },
        'a',
        'O'
      )
    ).toThrow('중복')
  })

  it('우수 민원 점수 — 100점', () => {
    const s = engine.scoreRequest('r-1')
    expect(s.responseScore).toBe(100)
    expect(s.resolutionScore).toBe(100)
    expect(s.reinquiryScore).toBe(100)
    expect(s.satisfactionScore).toBe(100)
    expect(s.overallScore).toBe(100)
  })

  it('응답 속도 단계 — 48시간/7일/이후', () => {
    engine.recordRequest(
      {
        requestId: 'r-48',
        departmentId: 'X',
        citizenId: 'c',
        submittedAt: '2026-04-10T00:00:00Z',
        respondedAt: '2026-04-11T23:00:00Z', // 47h
        resolvedAt: '2026-04-12T00:00:00Z',
        reinquiryCount: 0,
        satisfaction: 5,
      },
      'a',
      'O'
    )
    engine.recordRequest(
      {
        requestId: 'r-7d',
        departmentId: 'X',
        citizenId: 'c',
        submittedAt: '2026-04-01T00:00:00Z',
        respondedAt: '2026-04-07T00:00:00Z', // 144h
        resolvedAt: '2026-04-08T00:00:00Z',
        reinquiryCount: 0,
        satisfaction: 5,
      },
      'a',
      'O'
    )
    engine.recordRequest(
      {
        requestId: 'r-late',
        departmentId: 'X',
        citizenId: 'c',
        submittedAt: '2026-03-01T00:00:00Z',
        respondedAt: '2026-03-20T00:00:00Z',
        resolvedAt: '2026-03-21T00:00:00Z',
        reinquiryCount: 0,
        satisfaction: 5,
      },
      'a',
      'O'
    )
    expect(engine.scoreRequest('r-48').responseScore).toBe(80)
    expect(engine.scoreRequest('r-7d').responseScore).toBe(50)
    expect(engine.scoreRequest('r-late').responseScore).toBe(0)
  })

  it('미응답 민원 — responseScore 0', () => {
    engine.recordRequest(
      {
        requestId: 'r-no-resp',
        departmentId: 'X',
        citizenId: 'c',
        submittedAt: '2026-04-10T10:00:00Z',
        reinquiryCount: 0,
      },
      'a',
      'O'
    )
    const s = engine.scoreRequest('r-no-resp')
    expect(s.responseScore).toBe(0)
    expect(s.resolutionScore).toBe(0)
  })

  it('재문의 감점', () => {
    engine.recordRequest(
      {
        requestId: 'r-reinq',
        departmentId: 'X',
        citizenId: 'c',
        submittedAt: '2026-04-10T10:00:00Z',
        respondedAt: '2026-04-10T11:00:00Z',
        resolvedAt: '2026-04-10T12:00:00Z',
        reinquiryCount: 3, // -75
        satisfaction: 3,
      },
      'a',
      'O'
    )
    const s = engine.scoreRequest('r-reinq')
    expect(s.reinquiryScore).toBe(25)
  })

  it('부서 점수 — dept-A EXCELLENT', () => {
    const ds = engine.scoreDepartment('dept-A')
    expect(ds.overallScore).toBe(100)
    expect(ds.grade).toBe('EXCELLENT')
    expect(ds.totalRequests).toBe(1)
  })

  it('부서 랭킹 — 높은 점수 우선', () => {
    engine.recordRequest(
      {
        requestId: 'r-b1',
        departmentId: 'dept-B',
        citizenId: 'c',
        submittedAt: '2026-04-10T00:00:00Z',
        respondedAt: '2026-04-20T00:00:00Z', // 0점
        reinquiryCount: 5, // 0점
      },
      'a',
      'O'
    )
    const rank = engine.rankDepartments()
    expect(rank[0]?.departmentId).toBe('dept-A')
    expect(rank[1]?.departmentId).toBe('dept-B')
    expect(rank[1]?.grade).toBe('POOR')
  })

  it('개선 권고 — 저조 부서', () => {
    engine.recordRequest(
      {
        requestId: 'r-poor',
        departmentId: 'dept-POOR',
        citizenId: 'c',
        submittedAt: '2026-04-10T00:00:00Z',
        respondedAt: '2026-04-20T00:00:00Z',
        reinquiryCount: 5,
      },
      'a',
      'O'
    )
    const rec = engine.generateRecommendations('dept-POOR')
    expect(rec.items.length).toBeGreaterThanOrEqual(3)
    expect(rec.items.some((i) => i.includes('응답'))).toBe(true)
    expect(rec.items.some((i) => i.includes('해결'))).toBe(true)
    expect(rec.items.some((i) => i.includes('재문의'))).toBe(true)
  })

  it('부서 기록 없음 오류', () => {
    expect(() => engine.scoreDepartment('nonexistent')).toThrow('부서 기록')
  })

  it('감사 로그 — citizenId 마스킹', () => {
    const log = engine.getAuditLog()
    const entry = log.find((e) => e.action === 'request.record')
    expect(entry?.detail.citizenIdMasked).not.toBe('citizen-001-private')
    expect(String(entry?.detail.citizenIdMasked ?? '')).toContain('***')
    expect(entry?.callerMasked).toContain('***')
  })
})
