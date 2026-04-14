import { describe, it, expect, beforeEach } from 'vitest'
import { ModelDriftCorrectorV3 } from '../model-drift-corrector-v3'

describe('ModelDriftCorrectorV3', () => {
  let svc: ModelDriftCorrectorV3

  beforeEach(() => {
    svc = new ModelDriftCorrectorV3()
  })

  it('returns null without baseline or samples', () => {
    expect(svc.analyze('m1')).toBeNull()
  })

  it('reports STABLE / MONITOR when drift is small', () => {
    svc.setBaseline('m1', 0.9)
    svc.recordSample({ modelId: 'm1', timestamp: 1, accuracy: 0.895, f1: 0.89 })
    svc.recordSample({ modelId: 'm1', timestamp: 2, accuracy: 0.895, f1: 0.89 })
    const r = svc.analyze('m1')
    expect(r?.status).toBe('STABLE')
    expect(r?.action).toBe('MONITOR')
  })

  it('reports WARNING / RECALIBRATE for mild drift', () => {
    svc.setBaseline('m2', 0.9)
    svc.recordSample({ modelId: 'm2', timestamp: 1, accuracy: 0.86, f1: 0.85 })
    const r = svc.analyze('m2')
    expect(r?.status).toBe('WARNING')
    expect(r?.action).toBe('RECALIBRATE')
  })

  it('reports DRIFT / RETRAIN when accuracy dropped moderately', () => {
    svc.setBaseline('m3', 0.9)
    svc.recordSample({ modelId: 'm3', timestamp: 1, accuracy: 0.78, f1: 0.77 })
    const r = svc.analyze('m3')
    expect(r?.status).toBe('DRIFT')
    expect(r?.action).toBe('RETRAIN')
  })

  it('reports SEVERE_DRIFT / ROLLBACK on large accuracy drop', () => {
    svc.setBaseline('m4', 0.9)
    svc.recordSample({ modelId: 'm4', timestamp: 1, accuracy: 0.5, f1: 0.5 })
    const r = svc.analyze('m4')
    expect(r?.status).toBe('SEVERE_DRIFT')
    expect(r?.action).toBe('ROLLBACK')
  })

  it('blocks C/S grade sample recording', () => {
    expect(() =>
      svc.recordSample({ modelId: 'm5', timestamp: 1, accuracy: 0.9, f1: 0.9 }, 'C'),
    ).toThrow('BLOCKED')
  })

  it('masks modelId in output and audit log', () => {
    svc.setBaseline('secret-model', 0.9)
    svc.recordSample({ modelId: 'secret-model', timestamp: 1, accuracy: 0.89, f1: 0.88 })
    const r = svc.analyze('secret-model')
    expect(r?.modelId).not.toBe('secret-model')
    expect(r?.modelId).toHaveLength(16)
  })
})
