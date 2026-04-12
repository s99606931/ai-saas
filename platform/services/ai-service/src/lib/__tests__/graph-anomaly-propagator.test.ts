/**
 * Unit tests for Graph Anomaly Propagator — SVC-AI-ADV-R101
 */

import { describe, it, expect } from 'vitest'
import { GraphAnomalyPropagator } from '../graph-anomaly-propagator'

describe('SVC-AI-ADV-R101 GraphAnomalyPropagator', () => {
  it('[FR-R101.1] adds nodes and edges', () => {
    const g = new GraphAnomalyPropagator()
    g.addNode('a')
    g.addEdge('a', 'b')
    const result = g.propagate()
    expect(Object.keys(result.scores).sort()).toEqual(['a', 'b'])
  })

  it('[FR-R101.3] anomaly propagates to neighbors', () => {
    const g = new GraphAnomalyPropagator()
    g.addEdge('a', 'b')
    g.addEdge('b', 'c')
    g.setScore('a', 1.0)
    const result = g.propagate({ maxIterations: 20 })
    // b should receive some of a's anomaly
    expect(result.scores.b).toBeGreaterThan(0)
    expect(result.scores.c).toBeGreaterThanOrEqual(0)
  })

  it('[FR-R101.5] converges on simple graph', () => {
    const g = new GraphAnomalyPropagator()
    g.addEdge('a', 'b')
    g.addEdge('b', 'a')
    g.setScore('a', 0.5)
    const result = g.propagate({ epsilon: 1e-3 })
    expect(result.converged).toBe(true)
  })

  it('[FR-R101.4] topK returns sorted highest scores', () => {
    const g = new GraphAnomalyPropagator()
    g.addNode('a')
    g.addNode('b')
    g.addNode('c')
    g.setScore('a', 0.1)
    g.setScore('b', 0.9)
    g.setScore('c', 0.3)
    const result = g.propagate({ topK: 2 })
    expect(result.topK).toHaveLength(2)
    expect(result.topK[0]!.nodeId).toBe('b')
  })

  it('[FR-R101.1] handles isolated node', () => {
    const g = new GraphAnomalyPropagator()
    g.addNode('solo')
    g.setScore('solo', 0.8)
    const result = g.propagate()
    expect(result.scores.solo).toBeGreaterThan(0)
  })

  it('[FR-R101.3] weighted edges differ from unweighted', () => {
    const g = new GraphAnomalyPropagator()
    g.addEdge('a', 'b', 3)
    g.addEdge('a', 'c', 1)
    g.setScore('a', 1.0)
    const result = g.propagate({ maxIterations: 10 })
    // b should accumulate more than c due to higher weight
    expect(result.scores.b ?? 0).toBeGreaterThan(result.scores.c ?? 0)
  })

  it('[FR-R101.3] maxIterations limits runtime', () => {
    const g = new GraphAnomalyPropagator()
    g.addEdge('a', 'b')
    g.setScore('a', 1.0)
    const result = g.propagate({ maxIterations: 2, epsilon: 0 })
    expect(result.iterations).toBeLessThanOrEqual(2)
  })

  it('[CSAP D-06] getAuditLog captures graph operations', () => {
    const g = new GraphAnomalyPropagator()
    g.addNode('x')
    g.addEdge('x', 'y')
    g.setScore('x', 0.5)
    g.propagate({ maxIterations: 2 })
    const log = g.getAuditLog()
    const actions = log.map((e) => e.action)
    expect(actions).toContain('addNode')
    expect(actions).toContain('addEdge')
    expect(actions).toContain('setScore')
    expect(actions).toContain('propagate')
  })
})
