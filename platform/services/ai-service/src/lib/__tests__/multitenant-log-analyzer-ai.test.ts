import { describe, it, expect, beforeEach } from 'vitest'
import { MultitenantLogAnalyzerAi, type TenantConfig, type LogEntry } from '../multitenant-log-analyzer-ai'

describe('MultitenantLogAnalyzerAi', () => {
  let analyzer: MultitenantLogAnalyzerAi

  const tenant: TenantConfig = {
    tenantId: 'TENANT001',
    name: '기관 A',
    errorRateThreshold: 0.1,
    logRetentionDays: 30,
  }

  const makeLog = (id: string, level: LogEntry['level'], message: string): LogEntry => ({
    tenantId: 'TENANT001',
    entryId: id,
    level,
    message,
    timestamp: Date.now(),
  })

  beforeEach(() => {
    analyzer = new MultitenantLogAnalyzerAi()
    analyzer.registerTenant(tenant)
  })

  it('테넌트 등록 감사 로그', () => {
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'tenant.register')).toBe(true)
  })

  it('로그 없으면 에러율 0', () => {
    const result = analyzer.analyze('TENANT001')
    expect(result.totalLogs).toBe(0)
    expect(result.errorRate).toBe(0)
  })

  it('에러율 임계값 초과 → ERROR_SPIKE 탐지', () => {
    for (let i = 0; i < 8; i++) analyzer.ingestLog(makeLog(`E${i}`, 'ERROR', '처리 실패'))
    for (let i = 0; i < 2; i++) analyzer.ingestLog(makeLog(`I${i}`, 'INFO', '정상'))
    // errorRate = 8/10 = 80% > 10%
    const result = analyzer.analyze('TENANT001')
    expect(result.anomalies.some((a) => a.type === 'ERROR_SPIKE')).toBe(true)
  })

  it('보안 키워드 로그 → SECURITY_EVENT 탐지', () => {
    analyzer.ingestLog(makeLog('SEC1', 'WARN', 'SQL injection attempt detected'))
    const result = analyzer.analyze('TENANT001')
    expect(result.anomalies.some((a) => a.type === 'SECURITY_EVENT')).toBe(true)
  })

  it('CRITICAL 로그 → PERFORMANCE_DEGRADATION 탐지', () => {
    analyzer.ingestLog(makeLog('CRIT1', 'CRITICAL', '서버 응답 없음'))
    const result = analyzer.analyze('TENANT001')
    expect(result.anomalies.some((a) => a.type === 'PERFORMANCE_DEGRADATION')).toBe(true)
  })

  it('미등록 테넌트 에러', () => {
    expect(() => analyzer.analyze('UNKNOWN')).toThrow()
  })

  it('미등록 테넌트 로그 수집 에러', () => {
    expect(() => analyzer.ingestLog({ ...makeLog('X1', 'INFO', 'test'), tenantId: 'UNKNOWN' })).toThrow()
  })

  it('분석 후 감사 로그', () => {
    analyzer.ingestLog(makeLog('L1', 'INFO', '정상'))
    analyzer.analyze('TENANT001')
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'log.analyze')).toBe(true)
  })
})
