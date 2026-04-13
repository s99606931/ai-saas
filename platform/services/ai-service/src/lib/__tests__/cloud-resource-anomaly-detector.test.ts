import { describe, it, expect, beforeEach } from 'vitest'
import { CloudResourceAnomalyDetector } from '../cloud-resource-anomaly-detector'

describe('CloudResourceAnomalyDetector', () => {
  let ai: CloudResourceAnomalyDetector

  beforeEach(() => {
    ai = new CloudResourceAnomalyDetector()
    ai.registerResource('r1', 'web-server', { cpuPercent: 80, memoryPercent: 85, networkMbps: 100 })
  })

  it('리소스 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'resource.register')).toBe(true)
  })

  it('임계값 미달 — 이상 없음', () => {
    ai.recordUsage('r1', 70, 80, 90)
    const anomalies = ai.getAnomalies('r1')
    expect(anomalies.length).toBe(0)
  })

  it('CPU 임계값 초과 — warning 탐지', () => {
    ai.recordUsage('r1', 90, 80, 90)
    const anomalies = ai.getAnomalies('r1')
    expect(anomalies.some((a) => a.metric === 'cpu' && a.severity === 'warning')).toBe(true)
  })

  it('150% 초과 — critical 탐지', () => {
    ai.recordUsage('r1', 130, 80, 90)
    const anomalies = ai.getAnomalies('r1')
    expect(anomalies.some((a) => a.metric === 'cpu' && a.severity === 'critical')).toBe(true)
  })

  it('여러 지표 동시 이상 탐지', () => {
    ai.recordUsage('r1', 90, 90, 110)
    const anomalies = ai.getAnomalies('r1')
    expect(anomalies.length).toBe(3)
  })

  it('getActiveAnomalies — 전체 리소스 이상 반환', () => {
    ai.registerResource('r2', 'db-server', { cpuPercent: 70, memoryPercent: 70, networkMbps: 50 })
    ai.recordUsage('r1', 90, 80, 90)
    ai.recordUsage('r2', 80, 80, 60)
    const all = ai.getActiveAnomalies()
    expect(all.length).toBeGreaterThan(0)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.recordUsage('r1', 50, 50, 50, 'C')).toThrow('BLOCKED')
  })

  it('미등록 리소스 에러', () => {
    expect(() => ai.getAnomalies('unknown')).toThrow()
  })
})
