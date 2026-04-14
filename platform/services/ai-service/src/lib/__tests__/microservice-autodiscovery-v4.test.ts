import { describe, it, expect, beforeEach } from 'vitest'
import { MicroserviceAutodiscoveryV4 } from '../microservice-autodiscovery-v4'

describe('MicroserviceAutodiscoveryV4', () => {
  let svc: MicroserviceAutodiscoveryV4

  beforeEach(() => {
    svc = new MicroserviceAutodiscoveryV4()
  })

  it('discovers healthy services', () => {
    svc.register({ serviceId: 's1', endpoint: 'http://s1', healthScore: 95, lastSeen: 1000 })
    const r = svc.discover(2000)
    expect(r).toHaveLength(1)
    expect(r[0]?.health).toBe('HEALTHY')
  })

  it('marks stale service as UNHEALTHY', () => {
    svc.register({ serviceId: 's2', endpoint: 'http://s2', healthScore: 95, lastSeen: 0 })
    const r = svc.discover(70_000)
    expect(r[0]?.health).toBe('UNHEALTHY')
  })

  it('marks moderately stale as DEGRADED', () => {
    svc.register({ serviceId: 's3', endpoint: 'http://s3', healthScore: 95, lastSeen: 0 })
    const r = svc.discover(40_000)
    expect(r[0]?.health).toBe('DEGRADED')
  })

  it('updates with heartbeat', () => {
    svc.register({ serviceId: 's4', endpoint: 'http://s4', healthScore: 50, lastSeen: 0 })
    svc.heartbeat('s4', 90, 5000)
    const r = svc.discover(6000)
    expect(r[0]?.health).toBe('HEALTHY')
  })

  it('blocks C/S grade registration', () => {
    expect(() =>
      svc.register({ serviceId: 'x', endpoint: 'e', healthScore: 90, lastSeen: 0 }, 'S'),
    ).toThrow('BLOCKED')
  })

  it('masks serviceId in discovery output', () => {
    svc.register({ serviceId: 'secret-service', endpoint: 'e', healthScore: 90, lastSeen: 0 })
    const r = svc.discover(1000)
    expect(r[0]?.serviceId).not.toBe('secret-service')
    expect(r[0]?.serviceId).toHaveLength(16)
  })
})
