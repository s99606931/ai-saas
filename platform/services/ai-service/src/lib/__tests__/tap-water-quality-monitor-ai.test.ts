// Plan SC: SVC-AI-ADV-R631
import { describe, it, expect, beforeEach } from 'vitest'
import { TapWaterQualityMonitorAI } from '../tap-water-quality-monitor-ai'

describe('TapWaterQualityMonitorAI', () => {
  let ai: TapWaterQualityMonitorAI

  beforeEach(() => {
    ai = new TapWaterQualityMonitorAI()
  })

  const sample = (overrides: Partial<Parameters<typeof ai.registerSample>[0]> = {}) => ({
    sampleId: overrides.sampleId ?? 's1',
    facilityCode: overrides.facilityCode ?? 'F-001',
    ph: overrides.ph ?? 7.2,
    turbidity: overrides.turbidity ?? 0.3,
    residualChlorine: overrides.residualChlorine ?? 0.5,
    collectedAt: overrides.collectedAt ?? '2026-04-13T00:00:00Z',
  })

  it('registerSample — 등록 시 감사 로그 기록', () => {
    ai.registerSample(sample())
    const log = ai.getAuditLog()
    expect(log[0]!.action).toBe('sample.register')
  })

  it('assess — 정상 수질은 excellent', () => {
    ai.registerSample(sample())
    const a = ai.assess('s1')
    expect(a.grade).toBe('excellent')
  })

  it('assess — pH 과다 시 unsafe', () => {
    ai.registerSample(sample({ ph: 9.5 }))
    const a = ai.assess('s1')
    expect(a.issues).toContain('pH 기준 초과')
  })

  it('assess — 탁도 초과 시 이슈 추가', () => {
    ai.registerSample(sample({ turbidity: 2.0 }))
    const a = ai.assess('s1')
    expect(a.issues.some((i) => i.includes('탁도'))).toBe(true)
  })

  it('assess — 잔류염소 부족 시 이슈 추가', () => {
    ai.registerSample(sample({ residualChlorine: 0.05 }))
    const a = ai.assess('s1')
    expect(a.issues).toContain('잔류염소 부족')
  })

  it('registerSample — C등급 차단 (N2SF N-05)', () => {
    expect(() => ai.registerSample(sample(), 'C')).toThrow('BLOCKED')
  })
})
