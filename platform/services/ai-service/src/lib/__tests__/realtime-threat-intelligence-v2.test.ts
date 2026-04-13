// Design Ref: §R424 — Environmental Impact Assessor
import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeThreatIntelligenceV2 } from '../realtime-threat-intelligence-v2'

describe('RealtimeThreatIntelligenceV2 (Env Impact Assessor)', () => {
  let assessor: RealtimeThreatIntelligenceV2

  beforeEach(() => {
    assessor = new RealtimeThreatIntelligenceV2()
  })

  it('grade A: 총 영향 < 20', () => {
    // ghg=0, noise=0(dB<=40), water=0 → total=0 → A
    const result = assessor.assess({ projectId: 'P001', emissionsTon: 0, noiseDb: 40, wastewaterTon: 0 })
    expect(result.grade).toBe('A')
    expect(result.totalImpact).toBeLessThan(20)
  })

  it('grade E: 총 영향 ≥ 80', () => {
    // ghg=100(50ton), noise=100(90dB), water=100(20ton) → total=100*0.5+100*0.2+100*0.3=100 → E
    const result = assessor.assess({ projectId: 'P002', emissionsTon: 50, noiseDb: 90, wastewaterTon: 20 })
    expect(result.grade).toBe('E')
  })

  it('ghgScore clip: emissionsTon 과다 → 최대 100', () => {
    const result = assessor.assess({ projectId: 'P003', emissionsTon: 100, noiseDb: 40, wastewaterTon: 0 })
    expect(result.ghgScore).toBe(100)
  })

  it('noiseScore: dB=40 → 0, dB=90 → 100', () => {
    const low = assessor.assess({ projectId: 'P004', emissionsTon: 0, noiseDb: 40, wastewaterTon: 0 })
    const high = assessor.assess({ projectId: 'P005', emissionsTon: 0, noiseDb: 90, wastewaterTon: 0 })
    expect(low.noiseScore).toBe(0)
    expect(high.noiseScore).toBe(100)
  })

  it('totalImpact 가중 합산 검증', () => {
    // ghg=40(20ton), noise=20(50dB), water=30(6ton)
    // total = 40*0.5 + 20*0.2 + 30*0.3 = 20+4+9 = 33 → B
    const result = assessor.assess({ projectId: 'P006', emissionsTon: 20, noiseDb: 50, wastewaterTon: 6 })
    expect(result.totalImpact).toBe(33)
    expect(result.grade).toBe('B')
  })

  it('감사 로그에 env.assess 기록', () => {
    assessor.assess({ projectId: 'P007', emissionsTon: 5, noiseDb: 45, wastewaterTon: 1 })
    const logs = assessor.getAuditLog()
    expect(logs.some((l) => l.action === 'env.assess')).toBe(true)
  })
})
