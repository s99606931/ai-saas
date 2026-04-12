/**
 * Tests — SVC-AI-ADV-R164 AI Service Catalog Manager
 */

import { describe, it, expect } from 'vitest'
import { AiServiceCatalogManagerR164 } from '../ai-service-catalog-manager-r164'

function makeMgr() {
  let t = 1_700_000_000_000
  return new AiServiceCatalogManagerR164({
    now: () => {
      t += 1
      return t
    },
  })
}

const sample = {
  name: 'Citizen Chatbot',
  category: 'chatbot',
  tags: ['rag', 'korean'],
  description: '시민 민원 응대 챗봇',
}

describe('AiServiceCatalogManagerR164', () => {
  it('서비스 등록 성공', () => {
    const m = makeMgr()
    const svc = m.register(sample, 'owner-1')
    expect(svc.id).toBe('citizen-chatbot')
    expect(svc.owner).toBe('owner-1')
  })

  it('중복 등록 차단', () => {
    const m = makeMgr()
    m.register(sample, 'owner-1')
    expect(() => m.register(sample, 'owner-1')).toThrow('duplicate_service')
  })

  it('discover 는 텍스트/태그/카테고리 필터', () => {
    const m = makeMgr()
    m.register(sample, 'owner-1')
    m.register({ ...sample, name: 'Doc Summarizer', tags: ['nlp'] }, 'owner-2')
    expect(m.discover({ text: 'chatbot' }).length).toBeGreaterThanOrEqual(1)
    expect(m.discover({ tag: 'rag' })).toHaveLength(1)
    expect(m.discover({ category: 'chatbot' })).toHaveLength(2)
  })

  it('소유자 외 접근은 access_denied', () => {
    const m = makeMgr()
    m.register(sample, 'owner-1')
    expect(() => m.getService('citizen-chatbot', 'user-x')).toThrow('access_denied')
  })

  it('접근 요청 → 승인 → getService 허용', () => {
    const m = makeMgr()
    m.register(sample, 'owner-1')
    const req = m.requestAccess('citizen-chatbot', 'user-1')
    m.approveAccess(req.id, 'owner-1')
    const svc = m.getService('citizen-chatbot', 'user-1')
    expect(svc.name).toBe('Citizen Chatbot')
  })

  it('비소유자 승인 시 unauthorized_approver', () => {
    const m = makeMgr()
    m.register(sample, 'owner-1')
    const req = m.requestAccess('citizen-chatbot', 'user-1')
    expect(() => m.approveAccess(req.id, 'user-z')).toThrow('unauthorized_approver')
  })

  it('요청 거절 후 접근 불가', () => {
    const m = makeMgr()
    m.register(sample, 'owner-1')
    const req = m.requestAccess('citizen-chatbot', 'user-1')
    m.rejectAccess(req.id, 'owner-1')
    expect(() => m.getService('citizen-chatbot', 'user-1')).toThrow('access_denied')
  })

  it('C/S 등급 서비스 등록 차단', () => {
    const m = makeMgr()
    expect(() => m.register(sample, 'owner-1', 'C')).toThrow('grade_blocked')
    expect(() => m.register(sample, 'owner-1', 'S')).toThrow('grade_blocked')
  })

  it('존재하지 않는 서비스 요청 차단', () => {
    const m = makeMgr()
    expect(() => m.requestAccess('nonexistent', 'u')).toThrow('service_not_found')
    expect(() => m.getService('nonexistent', 'u')).toThrow('service_not_found')
  })

  it('통계는 서비스 수 + 요청 현황', () => {
    const m = makeMgr()
    m.register(sample, 'owner-1')
    const r1 = m.requestAccess('citizen-chatbot', 'user-1')
    m.requestAccess('citizen-chatbot', 'user-2')
    m.approveAccess(r1.id, 'owner-1')
    const s = m.getStats()
    expect(s.totalServices).toBe(1)
    expect(s.pendingRequests).toBe(1)
    expect(s.approvedRequests).toBe(1)
  })

  it('감사 로그에 registered/approved 기록', () => {
    const m = makeMgr()
    m.register(sample, 'owner-1')
    const r = m.requestAccess('citizen-chatbot', 'u')
    m.approveAccess(r.id, 'owner-1')
    const events = m.getAuditLog().map((l) => l.event)
    expect(events).toContain('registered')
    expect(events).toContain('access_approved')
  })
})
