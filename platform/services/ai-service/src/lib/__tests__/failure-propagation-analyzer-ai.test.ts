import { describe, it, expect, beforeEach } from 'vitest'
import { FailurePropagationAnalyzerAi } from '../failure-propagation-analyzer-ai'

describe('FailurePropagationAnalyzerAi', () => {
  let analyzer: FailurePropagationAnalyzerAi

  beforeEach(() => {
    analyzer = new FailurePropagationAnalyzerAi()
  })

  it('should register a node', () => {
    analyzer.registerNode('n1', 'API Gateway', [])
    expect(analyzer.getAuditLog().length).toBeGreaterThan(0)
  })

  it('should return 1 affected node for isolated failure', () => {
    analyzer.registerNode('n1', 'API', [])
    analyzer.recordFailure('f1', 'n1')
    expect(analyzer.getAffectedNodeCount('f1')).toBe(1)
  })

  it('should propagate failure to dependent nodes', () => {
    analyzer.registerNode('n1', 'DB', [])
    analyzer.registerNode('n2', 'API', ['n1'])
    analyzer.registerNode('n3', 'Frontend', ['n2'])
    analyzer.recordFailure('f1', 'n1')
    // n1 fails -> n2 depends on n1 -> n3 depends on n2 → 3 affected
    expect(analyzer.getAffectedNodeCount('f1')).toBe(3)
  })

  it('should return active failures', () => {
    analyzer.registerNode('n1', 'DB', [])
    analyzer.recordFailure('f1', 'n1')
    analyzer.recordFailure('f2', 'n1')
    expect(analyzer.getActiveFailures()).toHaveLength(2)
  })

  it('should block C grade data', () => {
    analyzer.registerNode('n1', 'DB', [])
    expect(() => analyzer.recordFailure('f1', 'n1', 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    analyzer.registerNode('n1', 'DB', [])
    expect(() => analyzer.recordFailure('f1', 'n1', 'S')).toThrow('BLOCKED')
  })

  it('should return 0 for unknown failure', () => {
    expect(analyzer.getAffectedNodeCount('unknown')).toBe(0)
  })
})
