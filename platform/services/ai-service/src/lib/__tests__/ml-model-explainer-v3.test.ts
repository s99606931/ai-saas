import { describe, it, expect, beforeEach } from 'vitest'
import { MlModelExplainerV3 } from '../ml-model-explainer-v3'

describe('MlModelExplainerV3', () => {
  let svc: MlModelExplainerV3
  beforeEach(() => { svc = new MlModelExplainerV3() })

  it('FR-R633.1: register model', () => {
    svc.registerModel('m1')
    expect(svc.topFeatures('m1', 5)).toEqual([])
  })

  it('FR-R633.2: record contribution', () => {
    svc.registerModel('m1')
    svc.recordContribution('m1', 'age', 0.3)
    expect(svc.topFeatures('m1', 5).length).toBe(1)
  })

  it('FR-R633.2: blocks C grade', () => {
    svc.registerModel('m1')
    expect(() => svc.recordContribution('m1', 'f', 0.1, 'C')).toThrow('BLOCKED')
  })

  it('FR-R633.3: top features sorted by abs contribution', () => {
    svc.registerModel('m1')
    svc.recordContribution('m1', 'a', 0.2)
    svc.recordContribution('m1', 'b', -0.5)
    svc.recordContribution('m1', 'c', 0.3)
    expect(svc.topFeatures('m1', 2).map(f => f.feature)).toEqual(['b', 'c'])
  })

  it('FR-R633.4: consistency score decreases with variance', () => {
    svc.registerModel('m1')
    svc.recordContribution('m1', 'a', 0.1)
    svc.recordContribution('m1', 'b', 0.1)
    const highConsistency = svc.consistencyScore('m1')
    svc.recordContribution('m1', 'c', 1.5)
    const lowerConsistency = svc.consistencyScore('m1')
    expect(highConsistency).toBeGreaterThan(lowerConsistency)
  })

  it('FR-R633.5: audit log populated', () => {
    svc.registerModel('m1')
    expect(svc.getAuditLog().some(e => e.action === 'REGISTER_MODEL')).toBe(true)
  })
})
