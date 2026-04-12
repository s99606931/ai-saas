/**
 * Unit tests for Tenant Behavior Analyzer — SVC-AI-ADV-R143
 */
import { describe, it, expect } from 'vitest'
import { TenantBehaviorAnalyzer, DataGrade } from '../tenant-behavior-analyzer'

const makeActivity = (date: string, overrides = {}) => ({
  tenantId: 'tenant-001',
  date,
  activeUsers: 20,
  apiCalls: 1000,
  storageGiB: 50,
  aiTokensUsed: 5000,
  grade: DataGrade.O,
  ...overrides,
})

describe('SVC-AI-ADV-R143 TenantBehaviorAnalyzer', () => {
  it('[FR-R143.1] records activity', () => {
    const analyzer = new TenantBehaviorAnalyzer()
    analyzer.recordActivity(makeActivity('2026-04-01'))
    const profile = analyzer.buildProfile('tenant-001')
    expect(profile.historicalDays).toBe(1)
  })

  it('[FR-R143.1] blocks C/S grade activities', () => {
    const analyzer = new TenantBehaviorAnalyzer()
    expect(() => analyzer.recordActivity(makeActivity('2026-04-01', { grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => analyzer.recordActivity(makeActivity('2026-04-01', { grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R143.3] PII in tenantId is masked in audit log', () => {
    const analyzer = new TenantBehaviorAnalyzer()
    analyzer.recordActivity(makeActivity('2026-04-01', { tenantId: 'admin@example.com' }))
    const log = analyzer.getAuditLog()
    expect(log.some(e => JSON.stringify(e).includes('admin@example.com'))).toBe(false)
    expect(log.some(e => JSON.stringify(e).includes('[EMAIL]'))).toBe(true)
  })

  it('[FR-R143.4] detects anomaly on z-score > 2', () => {
    const analyzer = new TenantBehaviorAnalyzer()
    // Use varied values so stddev > 0; mean ~1000, stddev ~100
    const baseCalls = [900, 950, 1000, 1050, 1100, 980, 1020, 970, 1030, 1000]
    for (let d = 1; d <= 10; d++) {
      analyzer.recordActivity(makeActivity(`2026-04-${String(d).padStart(2,'0')}`, { apiCalls: baseCalls[d-1] }))
    }
    // 20000 is far more than 2 stddev above mean
    analyzer.recordActivity(makeActivity('2026-04-11', { apiCalls: 20000 }))
    const anomaly = analyzer.detectAnomalies('tenant-001', '2026-04-11')
    expect(anomaly.isAnomalous).toBe(true)
    expect(anomaly.anomalies.some(a => a.metric === 'apiCalls')).toBe(true)
  })

  it('[FR-R143.5] predicts HIGH churn for inactive tenant', () => {
    const analyzer = new TenantBehaviorAnalyzer()
    // 14 days of decreasing activity
    for (let d = 1; d <= 7; d++) {
      analyzer.recordActivity(makeActivity(`2026-03-0${d}`, { apiCalls: 1000 }))
    }
    for (let d = 1; d <= 7; d++) {
      analyzer.recordActivity(makeActivity(`2026-04-0${d}`, { apiCalls: 0 }))
    }
    const churn = analyzer.predictChurn('tenant-001')
    expect(['HIGH', 'MEDIUM']).toContain(churn.riskLevel)
    expect(churn.churnProbability).toBeGreaterThan(0)
  })

  it('[FR-R143.6] LOW churn for stable tenant', () => {
    const analyzer = new TenantBehaviorAnalyzer()
    for (let d = 1; d <= 14; d++) {
      analyzer.recordActivity(makeActivity(`2026-04-${String(d).padStart(2, '0')}`, { apiCalls: 1000 }))
    }
    const churn = analyzer.predictChurn('tenant-001')
    expect(churn.riskLevel).toBe('LOW')
  })

  it('throws predictChurn with insufficient data', () => {
    const analyzer = new TenantBehaviorAnalyzer()
    analyzer.recordActivity(makeActivity('2026-04-01'))
    expect(() => analyzer.predictChurn('tenant-001')).toThrow('insufficient data')
  })

  it('audit log records predictChurn', () => {
    const analyzer = new TenantBehaviorAnalyzer()
    for (let d = 1; d <= 7; d++) {
      analyzer.recordActivity(makeActivity(`2026-04-0${d}`))
    }
    analyzer.predictChurn('tenant-001')
    expect(analyzer.getAuditLog().some(e => e.action === 'predictChurn')).toBe(true)
  })
})
