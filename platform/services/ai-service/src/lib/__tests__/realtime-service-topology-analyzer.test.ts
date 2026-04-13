// Design Ref: §R415 — AI기반 실시간 서비스 토폴로지 분석
import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeServiceTopologyAnalyzer } from '../realtime-service-topology-analyzer'

describe('RealtimeServiceTopologyAnalyzer', () => {
  let analyzer: RealtimeServiceTopologyAnalyzer

  beforeEach(() => {
    analyzer = new RealtimeServiceTopologyAnalyzer()
  })

  it('SPOF: 인입 0 + 아웃 ≥ 2 노드 탐지', () => {
    analyzer.addNode({ nodeId: 'gateway', serviceName: 'API Gateway', tier: 'FRONTEND' })
    analyzer.addNode({ nodeId: 'svc-a', serviceName: 'Service A', tier: 'BACKEND' })
    analyzer.addNode({ nodeId: 'svc-b', serviceName: 'Service B', tier: 'BACKEND' })
    analyzer.addEdge({ fromNodeId: 'gateway', toNodeId: 'svc-a', latencyMs: 10 })
    analyzer.addEdge({ fromNodeId: 'gateway', toNodeId: 'svc-b', latencyMs: 15 })
    const report = analyzer.analyze()
    expect(report.spofNodes).toContain('gateway')
  })

  it('SPOF 없음: 인입 엣지 있는 노드', () => {
    analyzer.addNode({ nodeId: 'a', serviceName: 'A', tier: 'BACKEND' })
    analyzer.addNode({ nodeId: 'b', serviceName: 'B', tier: 'BACKEND' })
    analyzer.addEdge({ fromNodeId: 'a', toNodeId: 'b', latencyMs: 5 })
    const report = analyzer.analyze()
    // a: 인입0 아웃1 → SPOF 조건 미충족(아웃<2)
    expect(report.spofNodes).toHaveLength(0)
  })

  it('maxDepth: 경로 깊이 산출', () => {
    analyzer.addNode({ nodeId: 'n1', serviceName: 'N1', tier: 'FRONTEND' })
    analyzer.addNode({ nodeId: 'n2', serviceName: 'N2', tier: 'BACKEND' })
    analyzer.addNode({ nodeId: 'n3', serviceName: 'N3', tier: 'DATA' })
    analyzer.addEdge({ fromNodeId: 'n1', toNodeId: 'n2', latencyMs: 10 })
    analyzer.addEdge({ fromNodeId: 'n2', toNodeId: 'n3', latencyMs: 10 })
    const report = analyzer.analyze()
    expect(report.maxDepth).toBe(2)
  })

  it('criticalPath: 루트부터 경로 추적', () => {
    analyzer.addNode({ nodeId: 'root', serviceName: 'Root', tier: 'FRONTEND' })
    analyzer.addNode({ nodeId: 'child', serviceName: 'Child', tier: 'BACKEND' })
    analyzer.addEdge({ fromNodeId: 'root', toNodeId: 'child', latencyMs: 20 })
    const report = analyzer.analyze()
    expect(report.criticalPath).toContain('root')
  })

  it('노드/엣지 없음: 빈 리포트', () => {
    const report = analyzer.analyze()
    expect(report.totalNodes).toBe(0)
    expect(report.totalEdges).toBe(0)
    expect(report.spofNodes).toHaveLength(0)
  })

  it('감사 로그에 topology.analyze 기록', () => {
    analyzer.addNode({ nodeId: 'x', serviceName: 'X', tier: 'INFRA' })
    analyzer.analyze()
    const logs = analyzer.getAuditLog()
    expect(logs.some((l) => l.action === 'topology.analyze')).toBe(true)
  })
})
