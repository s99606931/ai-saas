/**
 * AI 기반 멀티클라우드 비용 최적화 단위 테스트 — SVC-AI-ADV-R179
 * Plan SC: FR-R179.1 ~ FR-R179.5
 */

import { describe, it, expect } from 'vitest'
import { MulticloudCostOptimizer, DataGrade } from '../multicloud-cost-optimizer'

const awsProvider = {
  id: 'aws',
  name: 'AWS',
  resources: [{ resourceType: 'compute', unitPrice: 100, unit: 'hour' }],
}
const azureProvider = {
  id: 'azure',
  name: 'Azure',
  resources: [{ resourceType: 'compute', unitPrice: 70, unit: 'hour' }],
}

describe('MulticloudCostOptimizer — R179', () => {
  it('FR-R179.1: 클라우드 제공자 등록 및 audit log', () => {
    const opt = new MulticloudCostOptimizer(DataGrade.O)
    opt.registerProvider(awsProvider)
    const log = opt.getAuditLog()
    expect(log[0]?.action).toBe('providerRegistered')
    expect(log[0]?.details.id).toBe('aws')
  })

  it('FR-R179.2: 사용량 기록 및 audit log', () => {
    const opt = new MulticloudCostOptimizer(DataGrade.O)
    opt.registerProvider(awsProvider)
    opt.recordUsage({ providerId: 'aws', resourceType: 'compute', quantity: 100, periodDays: 30 })
    const log = opt.getAuditLog()
    expect(log.some((e) => e.action === 'usageRecorded')).toBe(true)
  })

  it('FR-R179.3: 비용 계산 — 제공자별 비용', () => {
    const opt = new MulticloudCostOptimizer(DataGrade.O)
    opt.registerProvider(awsProvider)
    opt.registerProvider(azureProvider)
    opt.recordUsage({ providerId: 'aws', resourceType: 'compute', quantity: 10, periodDays: 30 })
    opt.recordUsage({ providerId: 'azure', resourceType: 'compute', quantity: 10, periodDays: 30 })
    const report = opt.analyzeCost('compute')
    expect(report.costs).toHaveLength(2)
    const awsCost = report.costs.find((c) => c.providerId === 'aws')
    expect(awsCost?.totalCost).toBe(1000)
  })

  it('FR-R179.4: 최적화 권고 — 절감율 20% 이상', () => {
    const opt = new MulticloudCostOptimizer(DataGrade.O)
    opt.registerProvider(awsProvider)
    opt.registerProvider(azureProvider)
    opt.recordUsage({ providerId: 'aws', resourceType: 'compute', quantity: 10, periodDays: 30 })
    opt.recordUsage({ providerId: 'azure', resourceType: 'compute', quantity: 10, periodDays: 30 })
    const report = opt.analyzeCost('compute')
    // aws=1000, azure=700, savings=300/1000=30% >= 20%
    expect(report.recommendations.length).toBeGreaterThan(0)
    expect(report.recommendations[0]?.targetProviderId).toBe('azure')
  })

  it('FR-R179.4: cheapestProviderId 정확', () => {
    const opt = new MulticloudCostOptimizer(DataGrade.O)
    opt.registerProvider(awsProvider)
    opt.registerProvider(azureProvider)
    opt.recordUsage({ providerId: 'aws', resourceType: 'compute', quantity: 10, periodDays: 30 })
    opt.recordUsage({ providerId: 'azure', resourceType: 'compute', quantity: 10, periodDays: 30 })
    const report = opt.analyzeCost('compute')
    expect(report.cheapestProviderId).toBe('azure')
  })

  it('FR-R179.5: audit log append-only', () => {
    const opt = new MulticloudCostOptimizer(DataGrade.O)
    opt.registerProvider(awsProvider)
    const log1 = opt.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    expect(opt.getAuditLog()).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new MulticloudCostOptimizer(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new MulticloudCostOptimizer(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 provider id throw', () => {
    const opt = new MulticloudCostOptimizer(DataGrade.O)
    expect(() => opt.registerProvider({ ...awsProvider, id: '' })).toThrow('must not be empty')
  })

  it('미등록 provider 사용량 기록 throw', () => {
    const opt = new MulticloudCostOptimizer(DataGrade.O)
    expect(() => opt.recordUsage({ providerId: 'unknown', resourceType: 'compute', quantity: 10, periodDays: 30 }))
      .toThrow('unknown provider')
  })
})
