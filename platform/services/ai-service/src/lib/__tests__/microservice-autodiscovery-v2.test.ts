// Plan SC: SVC-AI-ADV-R584-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { MicroserviceAutodiscoveryV2, type MicroserviceInfo } from '../microservice-autodiscovery-v2'

describe('MicroserviceAutodiscoveryV2', () => {
  let discovery: MicroserviceAutodiscoveryV2

  const svc1: MicroserviceInfo = {
    serviceId: 'SVC-1', name: '민원 API', version: '1.0.0',
    host: '10.0.0.1', port: 8080, status: 'UP',
    tags: ['api', '민원'], dependencies: ['SVC-2'],
    registeredAt: '2026-01-01T00:00:00Z',
  }
  const svc2: MicroserviceInfo = {
    serviceId: 'SVC-2', name: '인증 서비스', version: '2.0.0',
    host: '10.0.0.2', port: 8081, status: 'UP',
    tags: ['auth'], dependencies: [],
    registeredAt: '2026-01-01T00:00:00Z',
  }

  beforeEach(() => {
    discovery = new MicroserviceAutodiscoveryV2()
    discovery.registerService(svc1)
    discovery.registerService(svc2)
  })

  it('미등록 서비스 상태 업데이트 시 오류 발생', () => {
    expect(() => discovery.updateStatus('UNKNOWN', 'UP')).toThrow('Unknown service')
  })

  it('상태 필터로 검색 — UP만 반환', () => {
    discovery.updateStatus('SVC-2', 'DOWN')
    const results = discovery.discover({ status: 'UP' })
    expect(results.every((s) => s.status === 'UP')).toBe(true)
    expect(results.some((s) => s.serviceId === 'SVC-2')).toBe(false)
  })

  it('태그 필터로 검색', () => {
    const results = discovery.discover({ tags: ['민원'] })
    expect(results.some((s) => s.serviceId === 'SVC-1')).toBe(true)
    expect(results.some((s) => s.serviceId === 'SVC-2')).toBe(false)
  })

  it('mapDependencies: 직접 및 역방향 의존성 반환', () => {
    const map = discovery.mapDependencies('SVC-1')
    expect(map.directDependencies).toContain('SVC-2')
    expect(map.dependents).toHaveLength(0)

    const map2 = discovery.mapDependencies('SVC-2')
    expect(map2.dependents).toContain('SVC-1')
  })

  it('healthCheck: 전체 서비스 헬스 반환', () => {
    const results = discovery.healthCheck()
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.lastCheckedAt)).toBe(true)
  })

  it('nameContains 필터 검색', () => {
    const results = discovery.discover({ nameContains: '민원' })
    expect(results.some((s) => s.serviceId === 'SVC-1')).toBe(true)
    expect(results.some((s) => s.serviceId === 'SVC-2')).toBe(false)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    discovery.discover()
    const log1 = discovery.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = discovery.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
