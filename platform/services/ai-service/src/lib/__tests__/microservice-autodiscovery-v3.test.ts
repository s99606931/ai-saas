import { describe, it, expect, beforeEach } from 'vitest'
import { MicroserviceAutodiscoveryV3 } from '../microservice-autodiscovery-v3'

describe('MicroserviceAutodiscoveryV3', () => {
  let discovery: MicroserviceAutodiscoveryV3

  beforeEach(() => { discovery = new MicroserviceAutodiscoveryV3() })

  it('should register a healthy instance', () => {
    discovery.registerInstance('i1', 'auth-svc', '10.0.0.1', 8080)
    expect(discovery.getHealthyInstances('auth-svc')).toHaveLength(1)
  })

  it('should update health status', () => {
    discovery.registerInstance('i1', 'auth-svc', '10.0.0.1', 8080)
    discovery.updateHealth('i1', false)
    expect(discovery.getHealthyInstances('auth-svc')).toHaveLength(0)
    expect(discovery.getUnhealthyInstances()).toHaveLength(1)
  })

  it('should filter healthy instances by service name', () => {
    discovery.registerInstance('i1', 'auth-svc', '10.0.0.1', 8080)
    discovery.registerInstance('i2', 'order-svc', '10.0.0.2', 8081)
    expect(discovery.getHealthyInstances('auth-svc')).toHaveLength(1)
    expect(discovery.getHealthyInstances('order-svc')).toHaveLength(1)
  })

  it('should block C grade data', () => {
    discovery.registerInstance('i1', 'svc', 'host', 8080)
    expect(() => discovery.updateHealth('i1', true, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    discovery.registerInstance('i1', 'svc', 'host', 8080)
    expect(() => discovery.updateHealth('i1', true, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    discovery.registerInstance('i1', 'api-svc', '10.0.0.1', 3000)
    discovery.updateHealth('i1', false)
    expect(discovery.getAuditLog().length).toBeGreaterThan(0)
  })
})
