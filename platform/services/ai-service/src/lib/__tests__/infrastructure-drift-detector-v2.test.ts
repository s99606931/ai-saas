import { describe, it, expect, beforeEach } from 'vitest'
import { InfrastructureDriftDetectorV2 } from '../infrastructure-drift-detector-v2'

describe('InfrastructureDriftDetectorV2', () => {
  let svc: InfrastructureDriftDetectorV2
  beforeEach(() => { svc = new InfrastructureDriftDetectorV2() })

  it('FR-R631.1: register resource with zero drift', () => {
    svc.registerResource('r1', { cpu: '2', mem: '4Gi' })
    expect(svc.getDriftScore('r1')).toBe(0)
  })

  it('FR-R631.2: records actual and computes drift', () => {
    svc.registerResource('r1', { cpu: '2', mem: '4Gi' })
    svc.recordActual('r1', { cpu: '4', mem: '4Gi' })
    expect(svc.getDriftScore('r1')).toBeCloseTo(0.5, 5)
  })

  it('FR-R631.2: blocks C grade', () => {
    svc.registerResource('r1', { cpu: '2' })
    expect(() => svc.recordActual('r1', { cpu: '4' }, 'C')).toThrow('BLOCKED')
  })

  it('FR-R631.2: blocks S grade', () => {
    svc.registerResource('r1', { cpu: '2' })
    expect(() => svc.recordActual('r1', { cpu: '4' }, 'S')).toThrow('BLOCKED')
  })

  it('FR-R631.4: returns high drift resources', () => {
    svc.registerResource('r1', { cpu: '2' })
    svc.recordActual('r1', { cpu: '4' })
    expect(svc.getHighDriftResources(0.5).map(r => r.resourceId)).toEqual(['r1'])
  })

  it('FR-R631.5: audit log populated', () => {
    svc.registerResource('r1', { cpu: '2' })
    expect(svc.getAuditLog().some(e => e.action === 'REGISTER_RESOURCE')).toBe(true)
  })
})
