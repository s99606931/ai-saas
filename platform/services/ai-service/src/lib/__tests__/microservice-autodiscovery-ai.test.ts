import { describe, it, expect, beforeEach } from 'vitest'
import { MicroserviceAutodiscoveryAI } from '../microservice-autodiscovery-ai'
import type { ServiceDescriptor } from '../microservice-autodiscovery-ai'

describe('MicroserviceAutodiscoveryAI', () => {
  let ai: MicroserviceAutodiscoveryAI

  beforeEach(() => {
    ai = new MicroserviceAutodiscoveryAI()
    const svc1: ServiceDescriptor = {
      serviceId: 'SVC-1',
      name: '사용자 인증 서비스',
      endpoints: ['/auth/login', '/auth/logout'],
      tags: ['auth', 'security'],
      version: '2.0.0',
      healthy: true,
    }
    const svc2: ServiceDescriptor = {
      serviceId: 'SVC-2',
      name: '문서 관리 서비스',
      endpoints: ['/documents', '/documents/upload'],
      tags: ['document', 'storage'],
      version: '1.5.0',
      healthy: true,
    }
    const svc3: ServiceDescriptor = {
      serviceId: 'SVC-3',
      name: '결제 처리 서비스',
      endpoints: ['/payment/process'],
      tags: ['payment', 'finance'],
      version: '1.0.0',
      healthy: false,  // unhealthy
    }
    ai.registerService(svc1)
    ai.registerService(svc2)
    ai.registerService(svc3)
  })

  it('인텐트 키워드로 서비스 검색', () => {
    const result = ai.discover({ queryId: 'Q1', intent: '인증 로그인' })
    expect(result.totalFound).toBeGreaterThan(0)
    expect(result.matches.some((m) => m.serviceId === 'SVC-1')).toBe(true)
  })

  it('비정상 서비스는 검색 결과 제외', () => {
    const result = ai.discover({ queryId: 'Q2', intent: '결제 finance payment' })
    expect(result.matches.some((m) => m.serviceId === 'SVC-3')).toBe(false)
  })

  it('태그 필터링 적용', () => {
    const result = ai.discover({ queryId: 'Q3', intent: '서비스', requiredTags: ['document'] })
    expect(result.matches.every((m) => m.serviceId === 'SVC-2')).toBe(true)
  })

  it('최소 버전 필터링', () => {
    const result = ai.discover({ queryId: 'Q4', intent: '서비스', minVersion: '2.0.0' })
    expect(result.matches.every((m) => m.serviceId === 'SVC-1')).toBe(true)
  })

  it('매칭 없으면 totalFound=0', () => {
    const result = ai.discover({ queryId: 'Q5', intent: '전혀무관한검색어xyz' })
    expect(result.totalFound).toBe(0)
  })

  it('감사 로그 복사본 반환', () => {
    ai.discover({ queryId: 'Q6', intent: '인증' })
    const log = ai.getAuditLog()
    log.push({ timestamp: '', action: 'injected', queryId: 'X', detail: {} })
    expect(ai.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
