import { describe, it, expect, beforeEach } from 'vitest'
import { ModelDriftCorrectorV2 } from '../model-drift-corrector-v2'

describe('ModelDriftCorrectorV2', () => {
  let corrector: ModelDriftCorrectorV2

  beforeEach(() => { corrector = new ModelDriftCorrectorV2() })

  it('should register a model and compute zero drift initially', () => {
    corrector.registerModel('m1', 'classifier', 0.95)
    expect(corrector.getDriftScore('m1')).toBe(0)
  })

  it('should record drift and compute positive drift score', () => {
    corrector.registerModel('m1', 'classifier', 0.95)
    corrector.recordDrift('m1', 0.80)
    expect(corrector.getDriftScore('m1')).toBeCloseTo(0.15, 5)
  })

  it('should block C grade data (N2SF N-05)', () => {
    corrector.registerModel('m1', 'classifier', 0.95)
    expect(() => corrector.recordDrift('m1', 0.80, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data (N2SF N-05)', () => {
    corrector.registerModel('m1', 'classifier', 0.95)
    expect(() => corrector.recordDrift('m1', 0.80, 'S')).toThrow('BLOCKED')
  })

  it('should surface high-drift models above threshold', () => {
    corrector.registerModel('m1', 'classifier', 0.95)
    corrector.registerModel('m2', 'regressor', 0.90)
    corrector.recordDrift('m1', 0.60)
    corrector.recordDrift('m2', 0.88)
    const high = corrector.getHighDriftModels(0.1)
    expect(high.map(m => m.modelId)).toEqual(['m1'])
  })

  it('should maintain audit log for register and drift events', () => {
    corrector.registerModel('m1', 'classifier', 0.95)
    corrector.recordDrift('m1', 0.90)
    const log = corrector.getAuditLog()
    expect(log.some(e => e.action === 'REGISTER_MODEL')).toBe(true)
    expect(log.some(e => e.action === 'RECORD_DRIFT')).toBe(true)
  })
})
