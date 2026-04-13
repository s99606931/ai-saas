// Design Ref: §R387 — AI기반 자동 API 문서 동기화
import { describe, it, expect, beforeEach } from 'vitest'
import { ApiDocSyncAi, type ApiDocSpec, type ApiEndpoint } from '../api-doc-sync-ai'

describe('ApiDocSyncAi', () => {
  let syncAi: ApiDocSyncAi

  const makeEndpoint = (method: ApiEndpoint['method'], path: string, deprecated = false): ApiEndpoint => ({
    endpointId: `ep-${method}-${path.replace(/\//g, '-')}`,
    serviceId: 'svc-api',
    path,
    method,
    version: 'v1',
    description: `${method} ${path}`,
    parameters: [],
    responseSchema: '{}',
    deprecated,
  })

  beforeEach(() => {
    syncAi = new ApiDocSyncAi()
  })

  it('IN_SYNC: 문서와 실제 엔드포인트 일치', () => {
    const spec: ApiDocSpec = { specId: 'spec-1', serviceId: 'svc-api', version: 'v1', endpoints: [makeEndpoint('GET', '/users')], lastUpdatedAt: '2026-04-01' }
    syncAi.registerSpec(spec)
    syncAi.registerLiveEndpoints('svc-api', [makeEndpoint('GET', '/users')])
    const report = syncAi.sync('spec-1')
    expect(report.syncStatus).toBe('IN_SYNC')
    expect(report.missingDocs).toHaveLength(0)
  })

  it('MISSING_DOC: 실제 엔드포인트에 문서 없음', () => {
    const spec: ApiDocSpec = { specId: 'spec-2', serviceId: 'svc-api', version: 'v1', endpoints: [makeEndpoint('GET', '/users')], lastUpdatedAt: '2026-04-01' }
    syncAi.registerSpec(spec)
    syncAi.registerLiveEndpoints('svc-api', [makeEndpoint('GET', '/users'), makeEndpoint('POST', '/users')])
    const report = syncAi.sync('spec-2')
    expect(report.syncStatus).toBe('MISSING_DOC')
    expect(report.missingDocs).toContain('POST:/users')
  })

  it('OUTDATED: 문서 많고 실제 엔드포인트 적음', () => {
    const spec: ApiDocSpec = {
      specId: 'spec-3', serviceId: 'svc-api', version: 'v1',
      endpoints: [makeEndpoint('GET', '/a'), makeEndpoint('GET', '/b')],
      lastUpdatedAt: '2026-04-01',
    }
    syncAi.registerSpec(spec)
    syncAi.registerLiveEndpoints('svc-api', [makeEndpoint('GET', '/a')])
    const report = syncAi.sync('spec-3')
    expect(report.syncStatus).toBe('OUTDATED')
  })

  it('deprecated 엔드포인트 목록 반환', () => {
    const spec: ApiDocSpec = {
      specId: 'spec-4', serviceId: 'svc-api', version: 'v1',
      endpoints: [makeEndpoint('GET', '/old', true), makeEndpoint('GET', '/new')],
      lastUpdatedAt: '2026-04-01',
    }
    syncAi.registerSpec(spec)
    syncAi.registerLiveEndpoints('svc-api', [makeEndpoint('GET', '/old', true), makeEndpoint('GET', '/new')])
    const report = syncAi.sync('spec-4')
    expect(report.deprecatedEndpoints).toContain('GET:/old')
  })

  it('존재하지 않는 specId → 오류', () => {
    expect(() => syncAi.sync('nonexistent')).toThrow('Spec not found')
  })

  it('감사 로그에 sync 기록', () => {
    const spec: ApiDocSpec = { specId: 'spec-5', serviceId: 'svc-api', version: 'v1', endpoints: [], lastUpdatedAt: '2026-04-01' }
    syncAi.registerSpec(spec)
    syncAi.registerLiveEndpoints('svc-api', [])
    syncAi.sync('spec-5')
    const logs = syncAi.getAuditLog()
    expect(logs.some((l) => l.action === 'doc.sync')).toBe(true)
  })
})
