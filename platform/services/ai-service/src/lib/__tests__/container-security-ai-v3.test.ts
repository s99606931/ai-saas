import { describe, it, expect, beforeEach } from 'vitest'
import { ContainerSecurityAIV3 } from '../container-security-ai-v3'

describe('ContainerSecurityAIV3', () => {
  let scanner: ContainerSecurityAIV3

  beforeEach(() => {
    scanner = new ContainerSecurityAIV3()
  })

  it('N2SF C등급 이미지 등록 차단', () => {
    expect(() => scanner.registerImage('img1', [], [], 'C')).toThrow('BLOCKED')
  })

  it('CRITICAL CVE → BLOCK 권고', () => {
    scanner.registerImage('img2', ['l1'], [{ cveId: 'CVE-2024-0001', cvss: 9.8 }], 'O')
    const result = scanner.analyze('img2')
    expect(result.riskLevel).toBe('CRITICAL')
    expect(result.action).toBe('BLOCK')
  })

  it('LOW CVE + 이상행위 없음 → ALLOW', () => {
    scanner.registerImage('img3', ['l1'], [{ cveId: 'CVE-x', cvss: 2.0 }], 'O')
    const result = scanner.analyze('img3')
    expect(result.riskLevel).toBe('LOW')
    expect(result.action).toBe('ALLOW')
  })

  it('위험 syscall (ptrace) 가중치로 등급 상승', () => {
    scanner.registerImage('img4', ['l1'], [{ cveId: 'CVE-x', cvss: 6.0 }], 'O')
    scanner.reportAnomaly('img4', 'ptrace', 'badproc')
    scanner.reportAnomaly('img4', 'ptrace', 'badproc')
    const result = scanner.analyze('img4')
    expect(result.riskScore).toBeGreaterThanOrEqual(9)
    expect(result.riskLevel).toBe('CRITICAL')
  })

  it('통계: 등급별 카운트 정확', () => {
    scanner.registerImage('a', [], [{ cveId: 'x', cvss: 9.5 }], 'O')
    scanner.registerImage('b', [], [{ cveId: 'y', cvss: 1.0 }], 'O')
    const stats = scanner.getStats()
    expect(stats.totalImages).toBe(2)
    expect(stats.byLevel.CRITICAL).toBe(1)
    expect(stats.byLevel.LOW).toBe(1)
  })

  it('감사 로그 복사본 반환', () => {
    scanner.registerImage('img5', [], [], 'O')
    const log = scanner.getAuditLog()
    log.push({ timestamp: '', action: 'injected', imageId: 'X', detail: {} })
    expect(scanner.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
