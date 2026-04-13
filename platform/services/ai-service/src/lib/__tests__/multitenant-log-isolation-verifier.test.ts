// Design Ref: §R420 — AI기반 멀티테넌트 로그 분리 검증
import { describe, it, expect, beforeEach } from 'vitest'
import { MultitenantLogIsolationVerifier } from '../multitenant-log-isolation-verifier'

describe('MultitenantLogIsolationVerifier', () => {
  let verifier: MultitenantLogIsolationVerifier

  beforeEach(() => {
    verifier = new MultitenantLogIsolationVerifier()
  })

  it('ISOLATED: 정상 격리 — 다른 테넌트 ID 미포함', () => {
    verifier.submitLog({ logId: 'log-1', tenantId: 'tenant-A', userId: 'user001234', message: '정상 처리 완료', timestamp: '2026-04-13T08:00:00Z', serviceName: 'auth' })
    verifier.submitLog({ logId: 'log-2', tenantId: 'tenant-B', userId: 'user005678', message: '요청 처리', timestamp: '2026-04-13T08:01:00Z', serviceName: 'api' })
    const report = verifier.verify('tenant-A')
    expect(report.isolationStatus).toBe('ISOLATED')
    expect(report.violationCount).toBe(0)
  })

  it('VIOLATED: 메시지에 타 테넌트 ID 포함 → CRITICAL 위반', () => {
    verifier.submitLog({ logId: 'log-3', tenantId: 'tenant-A', userId: 'user009012', message: '테넌트 tenant-B 데이터 접근', timestamp: '2026-04-13T08:02:00Z', serviceName: 'data' })
    verifier.submitLog({ logId: 'log-4', tenantId: 'tenant-B', userId: 'user003456', message: '정상', timestamp: '2026-04-13T08:03:00Z', serviceName: 'data' })
    const report = verifier.verify('tenant-A')
    expect(report.isolationStatus).toBe('VIOLATED')
    expect(report.violations[0]?.severity).toBe('CRITICAL')
  })

  it('PII: 감사 로그에 userId 마스킹', () => {
    verifier.submitLog({ logId: 'log-5', tenantId: 'tenant-C', userId: 'user123456', message: '로그인', timestamp: '2026-04-13T08:04:00Z', serviceName: 'auth' })
    const logs = verifier.getAuditLog()
    const submitLog = logs.find((l) => l.action === 'log.submit')
    expect(submitLog?.detail).not.toContain('user123456')
    expect(submitLog?.detail).toContain('*')
  })

  it('위반 시 권고사항 포함', () => {
    verifier.submitLog({ logId: 'log-6', tenantId: 'tenant-X', userId: 'userABCDEF', message: 'tenant-Y 정보', timestamp: '2026-04-13T08:05:00Z', serviceName: 'svc' })
    verifier.submitLog({ logId: 'log-7', tenantId: 'tenant-Y', userId: 'userGHIJKL', message: '정상', timestamp: '2026-04-13T08:06:00Z', serviceName: 'svc' })
    const report = verifier.verify('tenant-X')
    expect(report.recommendations.some((r) => r.includes('CRITICAL'))).toBe(true)
  })

  it('로그 없는 테넌트: 빈 리포트', () => {
    const report = verifier.verify('tenant-empty')
    expect(report.totalLogs).toBe(0)
    expect(report.isolationStatus).toBe('ISOLATED')
  })

  it('감사 로그에 isolation.verify 기록', () => {
    verifier.submitLog({ logId: 'log-8', tenantId: 'tenant-D', userId: 'userMNOPQR', message: '테스트', timestamp: '2026-04-13T08:07:00Z', serviceName: 'test' })
    verifier.verify('tenant-D')
    const logs = verifier.getAuditLog()
    expect(logs.some((l) => l.action === 'isolation.verify')).toBe(true)
  })
})
