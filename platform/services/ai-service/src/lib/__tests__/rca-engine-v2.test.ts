/**
 * Unit tests for RCA Engine V2 — SVC-AI-ADV-R128
 */
import { describe, it, expect, vi } from 'vitest'
import { RcaEngineV2, DataGrade } from '../rca-engine-v2'

const makeEngine = () => {
  const engine = new RcaEngineV2()
  engine.addNode({ id: 'svc-a', type: 'service', name: 'Service A' })
  engine.addNode({ id: 'db-1', type: 'database', name: 'Database 1' })
  engine.addNode({ id: 'svc-b', type: 'service', name: 'Service B' })
  engine.addEdge({ from: 'svc-a', to: 'db-1', type: 'reads_from', errorRate: 0.8, latencyMs: 4000 })
  engine.addEdge({ from: 'svc-b', to: 'svc-a', type: 'calls', errorRate: 0.6, latencyMs: 2000 })
  return engine
}

const makeSymptom = (overrides = {}) => ({
  nodeId: 'svc-b',
  description: 'High error rate',
  severity: 'high' as const,
  detectedAt: '2026-04-12T10:00:00Z',
  grade: DataGrade.O,
  ...overrides,
})

describe('SVC-AI-ADV-R128 RcaEngineV2', () => {
  it('[FR-R128.1] adds nodes and edges', () => {
    const engine = makeEngine()
    expect(engine.getAuditLog().some(e => e.action === 'addNode')).toBe(true)
    expect(engine.getAuditLog().some(e => e.action === 'addEdge')).toBe(true)
  })

  it('[FR-R128.4] analyze returns causal chains', async () => {
    const engine = makeEngine()
    const result = await engine.analyze('INC-001', [makeSymptom()])
    expect(result.causalChains.length).toBeGreaterThan(0)
    expect(result.topCause).not.toBeNull()
  })

  it('[FR-R128.5] remediations include database guidance', async () => {
    const engine = makeEngine()
    const result = await engine.analyze('INC-002', [makeSymptom({ nodeId: 'svc-b' })])
    expect(result.remediations.length).toBeGreaterThan(0)
  })

  it('[FR-R128] blocks C/S grade symptoms', async () => {
    const engine = makeEngine()
    await expect(engine.analyze('INC-003', [makeSymptom({ grade: DataGrade.C })])).rejects.toThrow('BLOCKED')
    await expect(engine.analyze('INC-004', [makeSymptom({ grade: DataGrade.S })])).rejects.toThrow('BLOCKED')
  })

  it('[FR-R128.6] audit log records analyze', async () => {
    const engine = makeEngine()
    await engine.analyze('INC-005', [makeSymptom()])
    expect(engine.getAuditLog().some(e => e.action === 'analyze')).toBe(true)
  })

  it('LLM provider is called when set', async () => {
    const engine = makeEngine()
    const summarize = vi.fn().mockResolvedValue('LLM 분석 요약')
    engine.setLlmProvider({ summarize })
    const result = await engine.analyze('INC-006', [makeSymptom()])
    expect(summarize).toHaveBeenCalled()
    expect(result.llmSummary).toBe('LLM 분석 요약')
  })

  it('throws on edge with unknown node', () => {
    const engine = new RcaEngineV2()
    engine.addNode({ id: 'x', type: 'service', name: 'X' })
    expect(() => engine.addEdge({ from: 'x', to: 'unknown', type: 'calls' })).toThrow('unknown node')
  })

  it('single-node symptom returns self as root', async () => {
    const engine = new RcaEngineV2()
    engine.addNode({ id: 'isolated', type: 'service', name: 'Isolated' })
    const result = await engine.analyze('INC-007', [
      { nodeId: 'isolated', description: 'Failure', severity: 'high', detectedAt: '2026-04-12T10:00:00Z', grade: DataGrade.O }
    ])
    expect(result.topCause?.rootNodeId).toBe('isolated')
  })
})
