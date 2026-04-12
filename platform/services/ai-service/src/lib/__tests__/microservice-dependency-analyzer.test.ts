/**
 * Unit tests — Microservice Dependency Analyzer (SVC-AI-ADV-R108 트랙B)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R108-microservice.design.md
 * Plan SC: FR-R108-M.1 ~ FR-R108-M.6
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MicroserviceDependencyAnalyzer } from '../microservice-dependency-analyzer'

describe('SVC-AI-ADV-R108 MicroserviceDependencyAnalyzer', () => {
  let analyzer: MicroserviceDependencyAnalyzer

  beforeEach(() => {
    analyzer = new MicroserviceDependencyAnalyzer()
  })

  it('[FR-R108-M.1] 서비스 등록 후 그래프 내에 포함됨', () => {
    analyzer.registerService({ serviceId: 'svc-a', criticality: 'HIGH' })
    const graph = analyzer.exportGraph()
    expect(graph.services).toHaveLength(1)
    expect(graph.services[0]!.serviceId).toBe('svc-a')
  })

  it('[FR-R108-M.2] 의존성 추가 후 그래프에 반영됨', () => {
    analyzer.registerService({ serviceId: 'svc-a' })
    analyzer.registerService({ serviceId: 'svc-b' })
    analyzer.addDependency('svc-a', 'svc-b', 'SYNC')
    const graph = analyzer.exportGraph()
    expect(graph.dependencies).toHaveLength(1)
    expect(graph.dependencies[0]).toMatchObject({ from: 'svc-a', to: 'svc-b', type: 'SYNC' })
  })

  it('[FR-R108-M.2] 미등록 서비스 의존성 추가 시 에러', () => {
    analyzer.registerService({ serviceId: 'svc-a' })
    expect(() => analyzer.addDependency('svc-a', 'svc-unknown')).toThrow('Unknown service')
  })

  it('[FR-R108-M.3] 순환 없는 그래프에서 detectCycles 빈 배열 반환', () => {
    analyzer.registerService({ serviceId: 'svc-a' })
    analyzer.registerService({ serviceId: 'svc-b' })
    analyzer.registerService({ serviceId: 'svc-c' })
    analyzer.addDependency('svc-a', 'svc-b')
    analyzer.addDependency('svc-b', 'svc-c')
    expect(analyzer.detectCycles()).toHaveLength(0)
  })

  it('[FR-R108-M.3] 단순 순환 탐지 (A→B→A)', () => {
    analyzer.registerService({ serviceId: 'svc-a' })
    analyzer.registerService({ serviceId: 'svc-b' })
    analyzer.addDependency('svc-a', 'svc-b')
    analyzer.addDependency('svc-b', 'svc-a')
    const cycles = analyzer.detectCycles()
    expect(cycles.length).toBeGreaterThan(0)
    const allNodes = cycles.flatMap((c) => c.cycle)
    expect(allNodes).toContain('svc-a')
    expect(allNodes).toContain('svc-b')
  })

  it('[FR-R108-M.4] 영향 경로 분석 — 직접 의존 서비스 포함', () => {
    analyzer.registerService({ serviceId: 'gateway' })
    analyzer.registerService({ serviceId: 'auth' })
    analyzer.registerService({ serviceId: 'user-api' })
    analyzer.addDependency('gateway', 'auth')
    analyzer.addDependency('user-api', 'auth')
    // auth 변경 시 영향받는 서비스: gateway, user-api
    const impacted = analyzer.getImpactPath('auth')
    expect(impacted).toContain('gateway')
    expect(impacted).toContain('user-api')
    expect(impacted).not.toContain('auth')
  })

  it('[FR-R108-M.5] exportGraph 전체 구조 직렬화', () => {
    analyzer.registerService({ serviceId: 'svc-x', team: 'platform' })
    analyzer.registerService({ serviceId: 'svc-y' })
    analyzer.addDependency('svc-x', 'svc-y', 'ASYNC')
    const graph = analyzer.exportGraph()
    expect(graph.exportedAt).toBeDefined()
    expect(graph.services).toHaveLength(2)
    expect(graph.dependencies[0]!.type).toBe('ASYNC')
  })

  it('[FR-R108-M.6] CSAP D-06 감사 로그 append-only', () => {
    analyzer.registerService({ serviceId: 'svc-a' })
    analyzer.registerService({ serviceId: 'svc-b' })
    analyzer.addDependency('svc-a', 'svc-b')
    const log = analyzer.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(3)
    expect(log[0]!.action).toBe('service.register')
    const original = analyzer.getAuditLog()
    // append-only 검증: 반환된 배열 수정이 내부에 영향 없어야 함
    original.push({ timestamp: 'fake', action: 'injected', detail: {} })
    expect(analyzer.getAuditLog().length).toBe(log.length)
  })
})
