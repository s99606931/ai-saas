import { describe, it, expect, beforeEach } from 'vitest'
import { CloudNativeSecurityScanner, type CloudResource } from '../cloud-native-security-scanner'

describe('CloudNativeSecurityScanner', () => {
  let scanner: CloudNativeSecurityScanner

  const safeResource: CloudResource = {
    resourceId: 'POD001',
    name: '민원 API Pod',
    namespace: 'production',
    resourceType: 'POD',
    labels: { app: 'complaint-api' },
    privileged: false,
    runAsRoot: false,
    hasResourceLimits: true,
    hostNetwork: false,
    secretsInEnv: false,
    readOnlyFs: true,
    hasSecurityContext: true,
  }

  beforeEach(() => {
    scanner = new CloudNativeSecurityScanner()
    scanner.registerResource(safeResource)
  })

  it('리소스 등록 감사 로그', () => {
    const log = scanner.getAuditLog()
    expect(log.some((e) => e.action === 'resource.register')).toBe(true)
  })

  it('안전한 리소스 → PASS', () => {
    const report = scanner.scan('POD001')
    expect(report.overallRisk).toBe('PASS')
    expect(report.score).toBe(100)
    expect(report.violations.length).toBe(0)
  })

  it('특권 컨테이너 → CRITICAL', () => {
    scanner.registerResource({ ...safeResource, resourceId: 'POD002', privileged: true })
    const report = scanner.scan('POD002')
    expect(report.overallRisk).toBe('CRITICAL')
    expect(report.violations.some((v) => v.rule === 'PRIVILEGED_CONTAINER')).toBe(true)
  })

  it('ROOT 실행 → CRITICAL', () => {
    scanner.registerResource({ ...safeResource, resourceId: 'POD003', runAsRoot: true })
    const report = scanner.scan('POD003')
    expect(report.violations.some((v) => v.rule === 'ROOT_USER')).toBe(true)
  })

  it('환경변수 시크릿 → HIGH', () => {
    scanner.registerResource({ ...safeResource, resourceId: 'POD004', secretsInEnv: true })
    const report = scanner.scan('POD004')
    expect(report.violations.some((v) => v.rule === 'SECRET_IN_ENV')).toBe(true)
    expect(report.overallRisk).toBe('HIGH')
  })

  it('리소스 제한 없음 → MEDIUM', () => {
    scanner.registerResource({ ...safeResource, resourceId: 'POD005', hasResourceLimits: false })
    const report = scanner.scan('POD005')
    expect(report.violations.some((v) => v.rule === 'NO_RESOURCE_LIMITS')).toBe(true)
  })

  it('복수 위반 → 점수 감점', () => {
    scanner.registerResource({ ...safeResource, resourceId: 'POD006', privileged: true, runAsRoot: true, hasResourceLimits: false })
    const report = scanner.scan('POD006')
    expect(report.score).toBeLessThan(50)
  })

  it('미등록 리소스 에러', () => {
    expect(() => scanner.scan('UNKNOWN')).toThrow()
  })

  it('스캔 후 감사 로그', () => {
    scanner.scan('POD001')
    const log = scanner.getAuditLog()
    expect(log.some((e) => e.action === 'resource.scan')).toBe(true)
  })
})
