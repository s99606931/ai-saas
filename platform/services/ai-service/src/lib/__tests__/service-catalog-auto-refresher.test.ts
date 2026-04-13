// Plan SC: SVC-AI-ADV-R340
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceCatalogAutoRefresher } from '../service-catalog-auto-refresher'

describe('ServiceCatalogAutoRefresher', () => {
  let refresher: ServiceCatalogAutoRefresher

  beforeEach(() => {
    refresher = new ServiceCatalogAutoRefresher()
  })

  it('registerEntry — 감사 로그에 entry.register 기록', () => {
    refresher.registerEntry('svc-1', '민원서비스', 'civil', 60000)
    const log = refresher.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('entry.register')
    expect(log[0]!.detail).toBe('svc-1')
  })

  it('getCatalog — 등록된 엔트리 반환', () => {
    refresher.registerEntry('svc-1', '민원서비스', 'civil', 60000)
    refresher.registerEntry('svc-2', '결제서비스', 'payment', 30000)
    const catalog = refresher.getCatalog()
    expect(catalog).toHaveLength(2)
    expect(catalog.map((e) => e.id)).toContain('svc-1')
  })

  it('updateEntry — status 갱신 및 감사 로그 기록', () => {
    refresher.registerEntry('svc-1', '민원서비스', 'civil', 60000)
    refresher.updateEntry('svc-1', 'maintenance')
    const catalog = refresher.getCatalog()
    expect(catalog[0]!.status).toBe('maintenance')
    const log = refresher.getAuditLog()
    expect(log[1]!.action).toBe('entry.update')
  })

  it('getStaleEntries — TTL 초과 엔트리 반환', () => {
    // staleTtlMs=1 로 등록하면 즉시 stale
    refresher.registerEntry('svc-stale', '오래된서비스', 'old', 1)
    // lastUpdated를 과거로 조작하기 위해 충분히 작은 TTL 사용 + 짧은 지연
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const stale = refresher.getStaleEntries()
        expect(stale.length).toBeGreaterThanOrEqual(1)
        expect(stale[0]!.id).toBe('svc-stale')
        resolve()
      }, 5)
    })
  })

  it('updateEntry — C등급 데이터 갱신 차단 (N2SF N-05)', () => {
    refresher.registerEntry('svc-1', '민원서비스', 'civil', 60000)
    expect(() => refresher.updateEntry('svc-1', 'active', 'C')).toThrow('BLOCKED')
  })

  it('updateEntry — S등급 데이터 갱신 차단 (N2SF N-05)', () => {
    refresher.registerEntry('svc-1', '민원서비스', 'civil', 60000)
    expect(() => refresher.updateEntry('svc-1', 'active', 'S')).toThrow('N2SF N-05')
  })

  it('registerEntry — 필수 파라미터 누락 시 에러', () => {
    expect(() => refresher.registerEntry('', '이름', 'cat', 1000)).toThrow('필수')
    expect(() => refresher.registerEntry('id', '', 'cat', 1000)).toThrow('필수')
  })

  it('updateEntry — 없는 entryId 에러', () => {
    expect(() => refresher.updateEntry('nonexistent', 'active')).toThrow('entryId 없음')
  })
})
