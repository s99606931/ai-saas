/**
 * Unit tests for AI-Powered SLA Negotiator — SVC-AI-ADV-R138
 */

import { describe, it, expect } from 'vitest'
import {
  SlaNegotiatorAI,
  type SlaProposal,
  type OperationHistory,
} from '../sla-negotiator-ai'

const proposal: SlaProposal = {
  availability: 0.999,
  rtoMinutes: 30,
  rpoMinutes: 15,
  responseTimeMs: 500,
  monthlyRevenue: 10_000_000,
  penaltyRate: 0.1,
}

const goodHistory: OperationHistory = {
  avgAvailability: 0.9995,
  avgRtoMinutes: 20,
  avgRpoMinutes: 10,
  avgResponseTimeMs: 300,
  samplesCount: 1000,
}

const badHistory: OperationHistory = {
  avgAvailability: 0.98,
  avgRtoMinutes: 60,
  avgRpoMinutes: 30,
  avgResponseTimeMs: 1200,
  samplesCount: 1000,
}

describe('SVC-AI-ADV-R138 SlaNegotiatorAI', () => {
  it('[FR-R138.1] analyzes proposal with fields parsed correctly', () => {
    const n = new SlaNegotiatorAI({ now: () => 1000 })
    const result = n.analyze(proposal, goodHistory)
    expect(result.analyzedAt).toBe(1000)
    expect(result.alternatives).toHaveLength(3)
  })

  it('[FR-R138.2] computes high feasibility on good history', () => {
    const n = new SlaNegotiatorAI()
    const score = n.computeFeasibility(proposal, goodHistory)
    expect(score).toBeGreaterThanOrEqual(0.9)
  })

  it('[FR-R138.2] computes low feasibility on bad history', () => {
    const n = new SlaNegotiatorAI()
    const score = n.computeFeasibility(proposal, badHistory)
    expect(score).toBeLessThan(0.8)
  })

  it('[FR-R138.2] returns 0 feasibility when no samples', () => {
    const n = new SlaNegotiatorAI()
    const empty: OperationHistory = { ...goodHistory, samplesCount: 0 }
    expect(n.computeFeasibility(proposal, empty)).toBe(0)
  })

  it('[FR-R138.3] computes penalty = revenue × rate × violationProb', () => {
    const n = new SlaNegotiatorAI()
    const penalty = n.estimatePenalty(proposal, 0.5)
    expect(penalty).toBe(10_000_000 * 0.1 * 0.5)
  })

  it('[FR-R138.3] clamps violation probability to 0~1', () => {
    const n = new SlaNegotiatorAI()
    expect(n.estimatePenalty(proposal, -0.5)).toBe(0)
    expect(n.estimatePenalty(proposal, 1.5)).toBe(10_000_000 * 0.1)
  })

  it('[FR-R138.4] generates 3 alternatives with distinct stances', () => {
    const n = new SlaNegotiatorAI()
    const alts = n.generateAlternatives(proposal, goodHistory)
    const stances = alts.map((a) => a.stance)
    expect(stances).toEqual(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'])
  })

  it('[FR-R138.4] conservative has lower availability than aggressive', () => {
    const n = new SlaNegotiatorAI()
    const alts = n.generateAlternatives(proposal, goodHistory)
    const conservative = alts[0]!
    const aggressive = alts[2]!
    expect(conservative.availability).toBeLessThanOrEqual(aggressive.availability)
  })

  it('[FR-R138.4] recommends ACCEPT on high feasibility and low violation', () => {
    const n = new SlaNegotiatorAI()
    const result = n.analyze(proposal, goodHistory)
    expect(result.recommendation).toBe('ACCEPT')
  })

  it('[FR-R138.4] recommends REJECT on bad history', () => {
    const n = new SlaNegotiatorAI()
    const result = n.analyze(proposal, badHistory)
    expect(['REJECT', 'NEGOTIATE']).toContain(result.recommendation)
  })

  it('[FR-R138.5] exposes audit log via getAuditLog()', () => {
    const n = new SlaNegotiatorAI({ now: () => 2000 })
    n.analyze(proposal, goodHistory)
    const logs = n.getAuditLog()
    expect(logs).toHaveLength(1)
    expect(logs[0]!.event).toBe('sla.negotiation.analyzed')
    expect(logs[0]!.at).toBe(2000)
  })

  it('[FR-R138.6] blocks C-grade data', () => {
    const n = new SlaNegotiatorAI()
    expect(() => n.analyze(proposal, goodHistory, 'C')).toThrow(/BLOCKED/)
  })

  it('[FR-R138.6] blocks S-grade data', () => {
    const n = new SlaNegotiatorAI()
    expect(() => n.analyze(proposal, goodHistory, 'S')).toThrow(/BLOCKED/)
  })

  it('[FR-R138.1] validates malformed proposal', () => {
    const n = new SlaNegotiatorAI()
    const invalid: SlaProposal = { ...proposal, availability: 2.0 }
    expect(() => n.analyze(invalid, goodHistory)).toThrow(/INVALID_PROPOSAL/)
  })
})
