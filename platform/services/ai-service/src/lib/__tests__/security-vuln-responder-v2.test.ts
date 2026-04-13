// Plan SC: SVC-AI-ADV-R435-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityVulnResponderV2, type Vulnerability } from '../security-vuln-responder-v2'

describe('SecurityVulnResponderV2', () => {
  let responder: SecurityVulnResponderV2

  beforeEach(() => {
    responder = new SecurityVulnResponderV2()
  })

  const baseVuln: Vulnerability = {
    vulnId: 'V-001',
    serviceId: 'SVC-1',
    type: 'CVE',
    severity: 'HIGH',
    detail: 'Remote code execution vulnerability',
    discoveredAt: Date.now(),
    cveId: 'CVE-2026-1234',
  }

  it('미등록 취약점 대응 시 오류 발생', () => {
    expect(() => responder.respond('UNKNOWN')).toThrow('Unknown vulnerability')
  })

  it('CVE 취약점 → PATCH 액션 포함', () => {
    responder.reportVuln(baseVuln)
    const response = responder.respond('V-001')
    const patchAction = response.actions.find((a) => a.action === 'PATCH')
    expect(patchAction).toBeDefined()
  })

  it('노출 시크릿 → ROTATE_SECRET + BLOCK_PORT', () => {
    responder.reportVuln({ ...baseVuln, vulnId: 'V-SECRET', type: 'EXPOSED_SECRET' })
    const response = responder.respond('V-SECRET')
    expect(response.actions.find((a) => a.action === 'ROTATE_SECRET')).toBeDefined()
    expect(response.actions.find((a) => a.action === 'BLOCK_PORT')).toBeDefined()
  })

  it('CRITICAL 취약점 → ESCALATE 액션 + SLA 4시간', () => {
    responder.reportVuln({ ...baseVuln, vulnId: 'V-CRIT', severity: 'CRITICAL' })
    const response = responder.respond('V-CRIT')
    expect(response.actions.find((a) => a.action === 'ESCALATE')).toBeDefined()
    expect(response.priority).toBe(1)
    expect(response.slaHours).toBe(4)
  })

  it('낮은 심각도 → 낮은 우선순위 + 긴 SLA', () => {
    responder.reportVuln({ ...baseVuln, vulnId: 'V-LOW', severity: 'LOW' })
    const response = responder.respond('V-LOW')
    expect(response.priority).toBeGreaterThan(3)
    expect(response.slaHours).toBeGreaterThan(24)
  })

  it('resolve: 해결 처리', () => {
    responder.reportVuln(baseVuln)
    responder.respond('V-001')
    const resolved = responder.resolve('V-001')
    expect(resolved).toBe(true)
  })

  it('미응답 취약점 resolve → false', () => {
    responder.reportVuln(baseVuln)
    const resolved = responder.resolve('V-001')
    expect(resolved).toBe(false)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    responder.reportVuln(baseVuln)
    responder.respond('V-001')
    const log1 = responder.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', vulnId: 'X', detail: {} })
    const log2 = responder.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
