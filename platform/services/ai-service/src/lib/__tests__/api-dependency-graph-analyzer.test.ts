/**
 * API 의존성 그래프 분석기 단위 테스트 — SVC-AI-ADV-R162
 * Plan SC: FR-R162.1 ~ FR-R162.6
 */

import { describe, it, expect } from 'vitest'
import { APIDependencyGraphAnalyzer, DataGrade } from '../api-dependency-graph-analyzer'

describe('APIDependencyGraphAnalyzer — R162', () => {
  it('FR-R162.1: 서비스 등록 및 audit log', () => {
    const g = new APIDependencyGraphAnalyzer(DataGrade.O)
    g.registerService({ id: 'auth', name: '인증 서비스', team: 'platform' })
    const log = g.getAuditLog()
    expect(log[0]?.action).toBe('serviceRegistered')
  })

  it('FR-R162.2: 의존성 추가 및 audit log', () => {
    const g = new APIDependencyGraphAnalyzer(DataGrade.O)
    g.registerService({ id: 'A', name: 'A', team: 'team1' })
    g.registerService({ id: 'B', name: 'B', team: 'team1' })
    g.addDependency('A', 'B')
    const log = g.getAuditLog()
    expect(log.some((e) => e.action === 'dependencyAdded')).toBe(true)
  })

  it('FR-R162.3: 순환 탐지 — A → B → C → A', () => {
    const g = new APIDependencyGraphAnalyzer(DataGrade.O)
    ;['A', 'B', 'C'].forEach((id) => g.registerService({ id, name: id, team: 'team' }))
    g.addDependency('A', 'B')
    g.addDependency('B', 'C')
    g.addDependency('C', 'A')
    const report = g.analyzeGraph()
    expect(report.cycles.detected).toBe(true)
    expect(report.cycles.cycles.length).toBeGreaterThan(0)
  })

  it('FR-R162.3: 순환 없는 DAG', () => {
    const g = new APIDependencyGraphAnalyzer(DataGrade.O)
    ;['A', 'B', 'C'].forEach((id) => g.registerService({ id, name: id, team: 'team' }))
    g.addDependency('A', 'B')
    g.addDependency('B', 'C')
    const report = g.analyzeGraph()
    expect(report.cycles.detected).toBe(false)
  })

  it('FR-R162.4: 단일장애점 탐지 — 최다 in-degree 서비스', () => {
    const g = new APIDependencyGraphAnalyzer(DataGrade.O)
    ;['gateway', 'svc1', 'svc2', 'svc3'].forEach((id) => g.registerService({ id, name: id, team: 'team' }))
    g.addDependency('svc1', 'gateway')
    g.addDependency('svc2', 'gateway')
    g.addDependency('svc3', 'gateway')
    const report = g.analyzeGraph()
    expect(report.spof.services[0]?.id).toBe('gateway')
    expect(report.spof.services[0]?.inDegree).toBe(3)
  })

  it('FR-R162.5: 영향 분석 — 직접/전이 의존 서비스', () => {
    const g = new APIDependencyGraphAnalyzer(DataGrade.O)
    ;['A', 'B', 'C'].forEach((id) => g.registerService({ id, name: id, team: 'team' }))
    g.addDependency('B', 'A') // B calls A
    g.addDependency('C', 'B') // C calls B (transitive dep on A)
    const impact = g.analyzeImpact('A')
    expect(impact.directDependents).toContain('B')
    expect(impact.transitiveImpact).toContain('C')
    expect(impact.totalImpacted).toBe(2)
  })

  it('FR-R162.6: audit log append-only', () => {
    const g = new APIDependencyGraphAnalyzer(DataGrade.O)
    g.registerService({ id: 'A', name: 'A', team: 'team' })
    const log1 = g.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    const log2 = g.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new APIDependencyGraphAnalyzer(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new APIDependencyGraphAnalyzer(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 id 서비스 등록 throw', () => {
    const g = new APIDependencyGraphAnalyzer(DataGrade.O)
    expect(() => g.registerService({ id: '', name: 'X', team: 'team' })).toThrow('must not be empty')
  })

  it('미등록 서비스 의존성 추가 throw', () => {
    const g = new APIDependencyGraphAnalyzer(DataGrade.O)
    g.registerService({ id: 'A', name: 'A', team: 'team' })
    expect(() => g.addDependency('A', 'B')).toThrow('unknown service')
  })

  it('자기 의존성 금지 throw', () => {
    const g = new APIDependencyGraphAnalyzer(DataGrade.O)
    g.registerService({ id: 'A', name: 'A', team: 'team' })
    expect(() => g.addDependency('A', 'A')).toThrow('self-dependency')
  })
})
