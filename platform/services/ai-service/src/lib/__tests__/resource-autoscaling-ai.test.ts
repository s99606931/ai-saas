import { describe, it, expect, beforeEach } from 'vitest'
import { ResourceAutoscalingAi, type NodeConfig, type ResourceSnapshot } from '../resource-autoscaling-ai'

describe('ResourceAutoscalingAi', () => {
  let scaler: ResourceAutoscalingAi

  const node: NodeConfig = {
    nodeId: 'N001',
    name: '웹 서버 노드',
    maxCpu: 100,
    maxMemory: 32,
    currentReplicas: 2,
    minReplicas: 1,
    maxReplicas: 5,
  }

  const makeSnapshot = (cpu: number, memory: number): ResourceSnapshot => ({
    nodeId: 'N001',
    timestamp: Date.now(),
    cpuUsage: cpu,
    memoryUsage: memory,
    networkMbps: 100,
  })

  beforeEach(() => {
    scaler = new ResourceAutoscalingAi()
    scaler.registerNode(node)
  })

  it('노드 등록 감사 로그', () => {
    const log = scaler.getAuditLog()
    expect(log.some((e) => e.action === 'node.register')).toBe(true)
  })

  it('스냅샷 없으면 NO_CHANGE', () => {
    const decision = scaler.evaluate('N001')
    expect(decision.action).toBe('NO_CHANGE')
  })

  it('CPU 80% 이상 → SCALE_UP', () => {
    scaler.recordSnapshot(makeSnapshot(85, 50))
    scaler.recordSnapshot(makeSnapshot(90, 55))
    scaler.recordSnapshot(makeSnapshot(88, 52))
    const decision = scaler.evaluate('N001')
    expect(decision.action).toBe('SCALE_UP')
  })

  it('CPU/메모리 낮으면 → SCALE_DOWN', () => {
    scaler.recordSnapshot(makeSnapshot(20, 25))
    scaler.recordSnapshot(makeSnapshot(15, 20))
    scaler.recordSnapshot(makeSnapshot(18, 22))
    const decision = scaler.evaluate('N001')
    expect(decision.action).toBe('SCALE_DOWN')
  })

  it('스케일 업 시 maxReplicas 초과 금지', () => {
    const maxNode: NodeConfig = { ...node, nodeId: 'N002', currentReplicas: 5, maxReplicas: 5 }
    scaler.registerNode(maxNode)
    scaler.recordSnapshot({ nodeId: 'N002', timestamp: Date.now(), cpuUsage: 90, memoryUsage: 90, networkMbps: 100 })
    scaler.recordSnapshot({ nodeId: 'N002', timestamp: Date.now(), cpuUsage: 92, memoryUsage: 92, networkMbps: 100 })
    scaler.recordSnapshot({ nodeId: 'N002', timestamp: Date.now(), cpuUsage: 91, memoryUsage: 91, networkMbps: 100 })
    const decision = scaler.evaluate('N002')
    expect(decision.newReplicas).toBeLessThanOrEqual(5)
  })

  it('미등록 노드 에러', () => {
    expect(() => scaler.evaluate('UNKNOWN')).toThrow()
  })

  it('결정 목록 필터', () => {
    scaler.recordSnapshot(makeSnapshot(50, 50))
    scaler.recordSnapshot(makeSnapshot(50, 50))
    scaler.recordSnapshot(makeSnapshot(50, 50))
    scaler.evaluate('N001')
    const decisions = scaler.getDecisions('N001')
    expect(decisions.every((d) => d.nodeId === 'N001')).toBe(true)
  })

  it('스케일링 후 감사 로그', () => {
    scaler.recordSnapshot(makeSnapshot(85, 85))
    scaler.recordSnapshot(makeSnapshot(85, 85))
    scaler.recordSnapshot(makeSnapshot(85, 85))
    scaler.evaluate('N001')
    const log = scaler.getAuditLog()
    expect(log.some((e) => e.action === 'scaling.evaluate')).toBe(true)
  })
})
