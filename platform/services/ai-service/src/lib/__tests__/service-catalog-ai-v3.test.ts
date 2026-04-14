import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceCatalogAiV3 } from '../service-catalog-ai-v3'

describe('ServiceCatalogAiV3', () => {
  let svc: ServiceCatalogAiV3
  beforeEach(() => { svc = new ServiceCatalogAiV3() })

  it('FR-R632.1: register catalog entry', () => {
    svc.register('s1', 'Service 1', 'cat-a', 0.9)
    expect(svc.findByCategory('cat-a').length).toBe(1)
  })

  it('FR-R632.2: update metadata', () => {
    svc.register('s1', 'Service 1', 'cat-a', 0.9)
    svc.updateMetadata('s1', { owner: 'team1' })
    expect(svc.findByCategory('cat-a')[0]!.metadata['owner']).toBe('team1')
  })

  it('FR-R632.2: blocks C grade', () => {
    svc.register('s1', 'Service 1', 'cat-a', 0.9)
    expect(() => svc.updateMetadata('s1', { k: 'v' }, 'C')).toThrow('BLOCKED')
  })

  it('FR-R632.3: find by category', () => {
    svc.register('s1', 'A', 'cat-a', 0.9)
    svc.register('s2', 'B', 'cat-b', 0.8)
    expect(svc.findByCategory('cat-b').map(e => e.serviceId)).toEqual(['s2'])
  })

  it('FR-R632.4: recommend by confidence', () => {
    svc.register('s1', 'A', 'cat-a', 0.5)
    svc.register('s2', 'B', 'cat-a', 0.95)
    svc.register('s3', 'C', 'cat-a', 0.7)
    expect(svc.recommend(2).map(e => e.serviceId)).toEqual(['s2', 's3'])
  })

  it('FR-R632.5: audit log populated', () => {
    svc.register('s1', 'A', 'cat-a', 0.9)
    expect(svc.getAuditLog().some(e => e.action === 'REGISTER_ENTRY')).toBe(true)
  })
})
