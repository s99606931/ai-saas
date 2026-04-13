// Design Ref: §R417 — AI기반 자동 컨테이너 보안 스캐닝 v2
import { describe, it, expect, beforeEach } from 'vitest'
import { ContainerSecurityScannerV2 } from '../container-security-scanner-v2'

describe('ContainerSecurityScannerV2', () => {
  let scanner: ContainerSecurityScannerV2

  beforeEach(() => {
    scanner = new ContainerSecurityScannerV2()
  })

  it('BLOCK: CRITICAL CVE → 배포 차단', () => {
    scanner.registerImage({ imageId: 'img-1', imageName: 'app', tag: 'latest', runAsRoot: false, layers: 5 })
    scanner.addCve('img-1', { cveId: 'CVE-001', severity: 'CRITICAL', packageName: 'openssl', fixAvailable: true })
    const report = scanner.scan('img-1')
    expect(report.deploymentDecision).toBe('BLOCK')
    expect(report.criticalCount).toBe(1)
  })

  it('BLOCK: runAsRoot → 배포 차단', () => {
    scanner.registerImage({ imageId: 'img-2', imageName: 'root-app', tag: 'v1', runAsRoot: true, layers: 3 })
    const report = scanner.scan('img-2')
    expect(report.deploymentDecision).toBe('BLOCK')
  })

  it('WARNING: HIGH CVE 2개 이상', () => {
    scanner.registerImage({ imageId: 'img-3', imageName: 'warn-app', tag: 'v2', runAsRoot: false, layers: 4 })
    scanner.addCve('img-3', { cveId: 'CVE-H1', severity: 'HIGH', packageName: 'curl', fixAvailable: false })
    scanner.addCve('img-3', { cveId: 'CVE-H2', severity: 'HIGH', packageName: 'libssl', fixAvailable: true })
    const report = scanner.scan('img-3')
    expect(report.deploymentDecision).toBe('WARNING')
    expect(report.highCount).toBe(2)
  })

  it('PASS: CVE 없고 non-root', () => {
    scanner.registerImage({ imageId: 'img-4', imageName: 'clean-app', tag: 'v3', runAsRoot: false, layers: 2 })
    const report = scanner.scan('img-4')
    expect(report.deploymentDecision).toBe('PASS')
    expect(report.securityScore).toBe(100)
  })

  it('securityScore: CRITICAL(-40) + root(-20) → 최소 0', () => {
    scanner.registerImage({ imageId: 'img-5', imageName: 'bad-app', tag: 'v1', runAsRoot: true, layers: 10 })
    scanner.addCve('img-5', { cveId: 'CVE-C1', severity: 'CRITICAL', packageName: 'bash', fixAvailable: false })
    scanner.addCve('img-5', { cveId: 'CVE-C2', severity: 'CRITICAL', packageName: 'sh', fixAvailable: false })
    const report = scanner.scan('img-5')
    expect(report.securityScore).toBe(0)
  })

  it('존재하지 않는 이미지 → 오류', () => {
    expect(() => scanner.scan('nonexistent')).toThrow('Image not found')
  })

  it('감사 로그에 image.scan 기록', () => {
    scanner.registerImage({ imageId: 'img-6', imageName: 'log-app', tag: 'v1', runAsRoot: false, layers: 1 })
    scanner.scan('img-6')
    const logs = scanner.getAuditLog()
    expect(logs.some((l) => l.action === 'image.scan')).toBe(true)
  })
})
