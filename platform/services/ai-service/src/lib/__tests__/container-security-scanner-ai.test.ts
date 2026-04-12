/**
 * 컨테이너 보안 스캐너 AI 단위 테스트 — SVC-AI-ADV-R157
 * Plan SC: FR-R157.1 ~ FR-R157.5
 */

import { describe, it, expect } from 'vitest'
import { ContainerSecurityScannerAI, DataGrade } from '../container-security-scanner-ai'

describe('ContainerSecurityScannerAI — R157', () => {
  it('FR-R157.1: CVE 등록 및 audit log', () => {
    const scanner = new ContainerSecurityScannerAI(DataGrade.O)
    scanner.registerCVE({
      id: 'CVE-2024-0001',
      cvss: 9.8,
      severity: 'critical',
      affectedPackages: ['openssl'],
      description: 'OpenSSL 취약점',
      fixedVersion: '3.0.8',
    })
    const log = scanner.getAuditLog()
    expect(log[0]?.action).toBe('cveRegistered')
    expect(log[0]?.details.id).toBe('CVE-2024-0001')
  })

  it('FR-R157.2: 이미지 스캔 — 취약 패키지 탐지', () => {
    const scanner = new ContainerSecurityScannerAI(DataGrade.O)
    scanner.registerCVE({
      id: 'CVE-2024-0001',
      cvss: 9.8,
      severity: 'critical',
      affectedPackages: ['openssl'],
      description: 'OpenSSL 취약점',
      fixedVersion: '3.0.8',
    })
    const report = scanner.scan({
      name: 'myapp',
      tag: 'latest',
      packages: [{ name: 'openssl', version: '3.0.5' }],
    })
    expect(report.findings).toHaveLength(1)
    expect(report.findings[0]?.cveId).toBe('CVE-2024-0001')
    expect(report.criticalCount).toBe(1)
  })

  it('FR-R157.3: findings 우선순위 내림차순 정렬', () => {
    const scanner = new ContainerSecurityScannerAI(DataGrade.O)
    scanner.registerCVE({ id: 'CVE-LOW', cvss: 2.0, severity: 'low', affectedPackages: ['libA'], description: 'low' })
    scanner.registerCVE({ id: 'CVE-CRIT', cvss: 9.5, severity: 'critical', affectedPackages: ['libA'], description: 'critical' })
    const report = scanner.scan({
      name: 'app',
      tag: 'v1',
      packages: [{ name: 'libA', version: '1.0' }],
    })
    expect(report.findings[0]?.severity).toBe('critical')
    expect(report.findings[1]?.severity).toBe('low')
  })

  it('FR-R157.4: 패치 권고 생성 — fixedVersion 있는 경우', () => {
    const scanner = new ContainerSecurityScannerAI(DataGrade.O)
    scanner.registerCVE({
      id: 'CVE-2024-0002',
      cvss: 7.5,
      severity: 'high',
      affectedPackages: ['curl'],
      description: 'curl 취약점',
      fixedVersion: '8.2.0',
    })
    const report = scanner.scan({
      name: 'webserver',
      tag: 'stable',
      packages: [{ name: 'curl', version: '7.88.0' }],
    })
    expect(report.patchRecommendations).toHaveLength(1)
    expect(report.patchRecommendations[0]?.upgradeToVersion).toBe('8.2.0')
  })

  it('FR-R157.5: audit log append-only', () => {
    const scanner = new ContainerSecurityScannerAI(DataGrade.O)
    scanner.registerCVE({ id: 'CVE-X', cvss: 5.0, severity: 'medium', affectedPackages: [], description: 'test' })
    const log1 = scanner.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    const log2 = scanner.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('C/S등급 차단', () => {
    expect(() => new ContainerSecurityScannerAI(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new ContainerSecurityScannerAI(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 CVE id 등록 throw', () => {
    const scanner = new ContainerSecurityScannerAI(DataGrade.O)
    expect(() => scanner.registerCVE({ id: '', cvss: 5.0, severity: 'medium', affectedPackages: [], description: 'x' }))
      .toThrow('must not be empty')
  })

  it('CVSS 범위 초과 throw', () => {
    const scanner = new ContainerSecurityScannerAI(DataGrade.O)
    expect(() => scanner.registerCVE({ id: 'CVE-X', cvss: 11, severity: 'critical', affectedPackages: [], description: 'x' }))
      .toThrow('CVSS must be 0~10')
  })

  it('매칭 없는 이미지 스캔 — findings 없음', () => {
    const scanner = new ContainerSecurityScannerAI(DataGrade.O)
    scanner.registerCVE({ id: 'CVE-X', cvss: 5.0, severity: 'medium', affectedPackages: ['openssl'], description: 'test' })
    const report = scanner.scan({ name: 'safe-app', tag: 'v1', packages: [{ name: 'nginx', version: '1.24' }] })
    expect(report.findings).toHaveLength(0)
    expect(report.criticalCount).toBe(0)
  })
})
