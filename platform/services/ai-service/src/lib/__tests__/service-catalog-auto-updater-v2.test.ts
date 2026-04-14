// Plan SC: SVC-AI-ADV-R560-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceCatalogAutoUpdaterV2, type CatalogEntry, type ServiceChangeEvent } from '../service-catalog-auto-updater-v2'

describe('ServiceCatalogAutoUpdaterV2', () => {
  let updater: ServiceCatalogAutoUpdaterV2

  const entry: CatalogEntry = {
    serviceId: 'SVC-1',
    name: '민원 처리 서비스',
    version: '1.0.0',
    status: 'ACTIVE',
    replicas: 2,
    configHash: 'abc123',
    lastUpdated: '2026-01-01T00:00:00Z',
  }

  const deployEvent: ServiceChangeEvent = {
    eventId: 'EVT-1',
    serviceId: 'SVC-1',
    eventType: 'DEPLOY',
    timestamp: '2026-02-01T00:00:00Z',
    payload: { version: '2.0.0' },
  }

  beforeEach(() => {
    updater = new ServiceCatalogAutoUpdaterV2()
    updater.initCatalog(entry)
  })

  it('미등록 서비스 조회 시 오류 발생', () => {
    expect(() => updater.getCatalogEntry('UNKNOWN')).toThrow('Unknown service')
  })

  it('DEPLOY 이벤트 → 버전 업데이트', () => {
    updater.registerEvent(deployEvent)
    updater.processEvents()
    const updated = updater.getCatalogEntry('SVC-1')
    expect(updated.version).toBe('2.0.0')
    expect(updated.status).toBe('ACTIVE')
  })

  it('SCALE 이벤트 → replicas 업데이트', () => {
    updater.registerEvent({ ...deployEvent, eventId: 'EVT-2', eventType: 'SCALE', payload: { replicas: 5 } })
    updater.processEvents()
    const updated = updater.getCatalogEntry('SVC-1')
    expect(updated.replicas).toBe(5)
  })

  it('RETIRE 이벤트 → status=DEPRECATED', () => {
    updater.registerEvent({ ...deployEvent, eventId: 'EVT-3', eventType: 'RETIRE', payload: {} })
    updater.processEvents()
    const updated = updater.getCatalogEntry('SVC-1')
    expect(updated.status).toBe('DEPRECATED')
  })

  it('processEvents → 처리된 이벤트 수 반환', () => {
    updater.registerEvent(deployEvent)
    updater.registerEvent({ ...deployEvent, eventId: 'EVT-4', eventType: 'SCALE', payload: { replicas: 3 } })
    const count = updater.processEvents()
    expect(count).toBe(2)
  })

  it('getChangeHistory: 처리된 이벤트 이력 반환', () => {
    updater.registerEvent(deployEvent)
    updater.processEvents()
    const history = updater.getChangeHistory('SVC-1')
    expect(history).toHaveLength(1)
    expect(history[0]?.eventType).toBe('DEPLOY')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    updater.registerEvent(deployEvent)
    updater.processEvents()
    const log1 = updater.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = updater.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
