import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityCertManagerAi } from '../security-cert-manager-ai'

describe('SecurityCertManagerAi', () => {
  let manager: SecurityCertManagerAi

  beforeEach(() => {
    manager = new SecurityCertManagerAi()
  })

  it('인증서 등록 후 조회 가능', () => {
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    const cert = manager.registerCert('cert-1', 'example.com', 'DigiCert', future)
    expect(cert.certId).toBe('cert-1')
    expect(cert.domain).toBe('example.com')
  })

  it('valid 상태: 30일 초과', () => {
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    manager.registerCert('cert-1', 'example.com', 'DigiCert', future)
    expect(manager.getCertStatus('cert-1')).toBe('valid')
  })

  it('expiring 상태: 30일 이하', () => {
    const soon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    manager.registerCert('cert-1', 'example.com', 'DigiCert', soon)
    expect(manager.getCertStatus('cert-1')).toBe('expiring')
  })

  it('expired 상태: 과거', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    manager.registerCert('cert-1', 'example.com', 'DigiCert', past)
    expect(manager.getCertStatus('cert-1')).toBe('expired')
  })

  it('getExpiringCerts: threshold 내 만료 인증서', () => {
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    const far = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    manager.registerCert('cert-1', 'soon.com', 'DigiCert', soon)
    manager.registerCert('cert-2', 'far.com', 'DigiCert', far)
    const expiring = manager.getExpiringCerts(30)
    expect(expiring.map((c) => c.certId)).toContain('cert-1')
    expect(expiring.map((c) => c.certId)).not.toContain('cert-2')
  })

  it('renewCert 후 상태 변경', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    manager.registerCert('cert-1', 'example.com', 'DigiCert', past)
    manager.renewCert('cert-1', future)
    expect(manager.getCertStatus('cert-1')).toBe('valid')
  })

  it('C등급 데이터 전송 차단', () => {
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    manager.registerCert('cert-1', 'example.com', 'DigiCert', future)
    const newExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    expect(() => manager.renewCert('cert-1', newExpiry, 'C')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    manager.registerCert('cert-1', 'example.com', 'DigiCert', future)
    const log = manager.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(1)
  })
})
