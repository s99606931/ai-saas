import { describe, it, expect, beforeEach } from 'vitest'
import { MulticloudNetworkOptimizerV4 } from '../multicloud-network-optimizer-v4'

describe('MulticloudNetworkOptimizerV4', () => {
  let svc: MulticloudNetworkOptimizerV4

  beforeEach(() => {
    svc = new MulticloudNetworkOptimizerV4()
  })

  it('returns null for unknown link', () => {
    expect(svc.analyze('nope')).toBeNull()
  })

  it('marks high-quality link as OPTIMAL', () => {
    svc.registerLink({
      linkId: 'L1',
      source: 'aws',
      destination: 'gcp',
      latencyMs: 50,
      bandwidthMbps: 1000,
      costPerGB: 0.02,
    })
    const r = svc.analyze('L1')
    expect(r?.status).toBe('OPTIMAL')
  })

  it('marks poor link as BOTTLENECK', () => {
    svc.registerLink({
      linkId: 'L2',
      source: 'aws',
      destination: 'azure',
      latencyMs: 900,
      bandwidthMbps: 50,
      costPerGB: 0.9,
    })
    const r = svc.analyze('L2')
    expect(r?.status).toBe('BOTTLENECK')
  })

  it('picks best link between endpoints', () => {
    svc.registerLink({ linkId: 'A', source: 'aws', destination: 'gcp', latencyMs: 100, bandwidthMbps: 500, costPerGB: 0.1 })
    svc.registerLink({ linkId: 'B', source: 'aws', destination: 'gcp', latencyMs: 30, bandwidthMbps: 900, costPerGB: 0.05 })
    const best = svc.getBestLink('aws', 'gcp')
    expect(best?.linkId).toBe('B')
  })

  it('blocks C/S grade data during registration', () => {
    expect(() =>
      svc.registerLink(
        { linkId: 'x', source: 'a', destination: 'b', latencyMs: 10, bandwidthMbps: 100, costPerGB: 0.1 },
        'C',
      ),
    ).toThrow('BLOCKED')
  })

  it('logs analyze actions in audit log', () => {
    svc.registerLink({ linkId: 'L3', source: 'aws', destination: 'gcp', latencyMs: 100, bandwidthMbps: 500, costPerGB: 0.1 })
    svc.analyze('L3')
    const log = svc.getAuditLog()
    expect(log.some((e) => e.action === 'ANALYZE_LINK')).toBe(true)
  })
})
