// Plan SC: SVC-AI-ADV-R400-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { MultitenantBehaviorAnalyzerAI, type TenantActivity } from '../multitenant-behavior-analyzer-ai'

describe('MultitenantBehaviorAnalyzerAI', () => {
  let analyzer: MultitenantBehaviorAnalyzerAI

  beforeEach(() => {
    analyzer = new MultitenantBehaviorAnalyzerAI()
  })

  const baseActivity = (overrides: Partial<TenantActivity> = {}): TenantActivity => ({
    activityId: 'A1',
    tenantId: 'T1',
    userId: 'U1',
    action: 'READ',
    resourceCount: 1,
    timestamp: Date.now(),
    ...overrides,
  })

  it('활동 없을 때 빈 결과 반환', () => {
    const result = analyzer.analyze('T1')
    expect(result.anomalies).toHaveLength(0)
    expect(result.riskScore).toBe(0)
    expect(result.blocked).toBe(false)
  })

  it('대량 내보내기(1000건 이상) 탐지', () => {
    analyzer.ingest(baseActivity({ activityId: 'BULK', resourceCount: 1500 }))
    const result = analyzer.analyze('T1')
    const bulkAnomaly = result.anomalies.find((a) => a.type === 'BULK_EXPORT')
    expect(bulkAnomaly).toBeDefined()
    expect(bulkAnomaly?.severity).toBe('HIGH')
  })

  it('업무 외 시간 접근 탐지: UTC 20시 이후 3건 이상', () => {
    const offHourBase = new Date()
    offHourBase.setUTCHours(21, 0, 0, 0)
    for (let i = 0; i < 3; i++) {
      analyzer.ingest(baseActivity({ activityId: `OH-${i}`, timestamp: offHourBase.getTime() + i * 60000 }))
    }
    const result = analyzer.analyze('T1')
    const offHoursAnomaly = result.anomalies.find((a) => a.type === 'OFF_HOURS_ACCESS')
    expect(offHoursAnomaly).toBeDefined()
  })

  it('크로스 테넌트 프로빙 탐지 → CRITICAL + blocked', () => {
    analyzer.ingest(baseActivity({ activityId: 'CROSS', targetTenantId: 'T2' }))
    const result = analyzer.analyze('T1')
    const crossAnomaly = result.anomalies.find((a) => a.type === 'CROSS_TENANT_PROBE')
    expect(crossAnomaly).toBeDefined()
    expect(crossAnomaly?.severity).toBe('CRITICAL')
    expect(result.blocked).toBe(true)
  })

  it('비정상 볼륨: 1시간 내 1000건 이상', () => {
    const now = Date.now()
    for (let i = 0; i < 1000; i++) {
      analyzer.ingest(baseActivity({ activityId: `V-${i}`, timestamp: now - i * 1000 }))
    }
    const result = analyzer.analyze('T1')
    const volumeAnomaly = result.anomalies.find((a) => a.type === 'UNUSUAL_VOLUME')
    expect(volumeAnomaly).toBeDefined()
  })

  it('위험도 60 이상 시 blocked=true', () => {
    // BULK_EXPORT(30) + CROSS_TENANT_PROBE(40) = 70 → blocked
    analyzer.ingest(baseActivity({ activityId: 'MULTI-1', resourceCount: 1500 }))
    analyzer.ingest(baseActivity({ activityId: 'MULTI-2', targetTenantId: 'EVIL' }))
    const result = analyzer.analyze('T1')
    expect(result.riskScore).toBeGreaterThanOrEqual(60)
    expect(result.blocked).toBe(true)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    analyzer.ingest(baseActivity())
    analyzer.analyze('T1')
    const log1 = analyzer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', tenantId: 'X', detail: {} })
    const log2 = analyzer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
