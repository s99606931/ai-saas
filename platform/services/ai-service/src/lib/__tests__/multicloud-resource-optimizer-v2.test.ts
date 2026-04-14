import { describe, it, expect, beforeEach } from 'vitest'
import { MulticloudResourceOptimizerV2 } from '../multicloud-resource-optimizer-v2'

describe('MulticloudResourceOptimizerV2', () => {
  let optimizer: MulticloudResourceOptimizerV2

  beforeEach(() => {
    optimizer = new MulticloudResourceOptimizerV2()
  })

  it('리소스 등록 후 조회 가능', () => {
    const res = optimizer.registerResource('res-1', 'AWS', 'EC2', 500)
    expect(res.resourceId).toBe('res-1')
    expect(res.monthlyCost).toBe(500)
  })

  it('사용률 0%: 낭비 비용 = monthlyCost', () => {
    optimizer.registerResource('res-1', 'AWS', 'EC2', 500)
    optimizer.recordUtilization('res-1', 0)
    expect(optimizer.getWastedCost('res-1')).toBe(500)
  })

  it('사용률 100%: 낭비 비용 0', () => {
    optimizer.registerResource('res-1', 'AWS', 'EC2', 500)
    optimizer.recordUtilization('res-1', 100)
    expect(optimizer.getWastedCost('res-1')).toBe(0)
  })

  it('사용률 60%: 낭비 비용 40%', () => {
    optimizer.registerResource('res-1', 'AWS', 'EC2', 1000)
    optimizer.recordUtilization('res-1', 60)
    expect(optimizer.getWastedCost('res-1')).toBe(400)
  })

  it('getOptimizationTargets: utilization < 30%', () => {
    optimizer.registerResource('res-1', 'AWS', 'EC2', 500)
    optimizer.registerResource('res-2', 'GCP', 'VM', 300)
    optimizer.recordUtilization('res-1', 20)
    optimizer.recordUtilization('res-2', 80)
    const targets = optimizer.getOptimizationTargets()
    expect(targets.map((r) => r.resourceId)).toContain('res-1')
    expect(targets.map((r) => r.resourceId)).not.toContain('res-2')
  })

  it('C등급 데이터 전송 차단', () => {
    optimizer.registerResource('res-1', 'AWS', 'EC2', 500)
    expect(() => optimizer.recordUtilization('res-1', 50, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    optimizer.registerResource('res-1', 'AWS', 'EC2', 500)
    expect(() => optimizer.recordUtilization('res-1', 50, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    optimizer.registerResource('res-1', 'AWS', 'EC2', 500)
    optimizer.recordUtilization('res-1', 50)
    const log = optimizer.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
