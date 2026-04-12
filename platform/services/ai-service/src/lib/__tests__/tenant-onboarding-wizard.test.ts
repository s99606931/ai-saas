import { describe, it, expect, beforeEach } from 'vitest'
import { TenantOnboardingWizard } from '../tenant-onboarding-wizard'

describe('TenantOnboardingWizard', () => {
  let w: TenantOnboardingWizard

  beforeEach(() => {
    w = new TenantOnboardingWizard()
    w.startOnboarding('tenant-1', 'pro', 'O', 'admin-1')
  })

  const completeAll = (tenantId: string) => {
    w.completeBasicInfo(tenantId, { name: '서울시', industry: '공공', employeeCount: 100 })
    w.completeAdminUser(tenantId, { email: 'admin@seoul.go.kr', fullName: '관리자' })
    w.completeDomain(tenantId, { subdomain: 'seoul-city' })
    w.completeSso(tenantId, { provider: 'NONE' })
    w.completeBilling(tenantId, { method: 'INVOICE', contactEmail: 'billing@seoul.go.kr' })
  }

  it('C등급 차단', () => {
    expect(() => w.startOnboarding('t2', 'pro', 'C', 'a')).toThrow('BLOCKED')
  })

  it('빈 tenantId 차단', () => {
    expect(() => w.startOnboarding('', 'pro', 'O', 'a')).toThrow('tenantId')
  })

  it('중복 tenantId 차단', () => {
    expect(() => w.startOnboarding('tenant-1', 'pro', 'O', 'a')).toThrow('중복')
  })

  it('없는 tenantId 조회 오류', () => {
    expect(() => w.getStatus('none')).toThrow('tenantId 없음')
  })

  it('초기 상태 — 0% 진행', () => {
    const s = w.getStatus('tenant-1')
    expect(s.progressPct).toBe(0)
    expect(s.status).toBe('IN_PROGRESS')
  })

  it('basic_info 검증 — 빈 name', () => {
    expect(() =>
      w.completeBasicInfo('tenant-1', { name: '', industry: '공공', employeeCount: 10 })
    ).toThrow('name')
  })

  it('admin email 검증', () => {
    expect(() =>
      w.completeAdminUser('tenant-1', { email: 'bad-email', fullName: 'X' })
    ).toThrow('email')
  })

  it('domain 형식 검증', () => {
    expect(() => w.completeDomain('tenant-1', { subdomain: 'AB' })).toThrow('subdomain')
    expect(() => w.completeDomain('tenant-1', { subdomain: 'a' })).toThrow('subdomain')
    expect(() =>
      w.completeDomain('tenant-1', { subdomain: 'has_underscore' })
    ).toThrow('subdomain')
  })

  it('SSO provider 시 metadataUrl 필수', () => {
    expect(() => w.completeSso('tenant-1', { provider: 'SAML' })).toThrow('metadataUrl')
  })

  it('billing email 검증', () => {
    expect(() =>
      w.completeBilling('tenant-1', { method: 'CARD', contactEmail: 'invalid' })
    ).toThrow('contactEmail')
  })

  it('단계별 진행률 상승', () => {
    w.completeBasicInfo('tenant-1', { name: '서울', industry: '공공', employeeCount: 10 })
    const s = w.getStatus('tenant-1')
    expect(s.progressPct).toBe(20) // 1/5
  })

  it('미완료 단계 finalize 차단', () => {
    w.completeBasicInfo('tenant-1', { name: '서울', industry: '공공', employeeCount: 10 })
    expect(() => w.finalize('tenant-1', 'admin')).toThrow('미완료 단계')
  })

  it('전체 완료 finalize 성공', () => {
    completeAll('tenant-1')
    const s = w.finalize('tenant-1', 'admin')
    expect(s.status).toBe('ACTIVE')
    expect(s.progressPct).toBe(100)
  })

  it('ACTIVE 상태 재활성화 차단', () => {
    completeAll('tenant-1')
    w.finalize('tenant-1', 'admin')
    expect(() => w.finalize('tenant-1', 'admin')).toThrow('활성화 불가')
  })

  it('cancel', () => {
    const s = w.cancel('tenant-1', 'admin')
    expect(s.status).toBe('CANCELLED')
  })

  it('감사 로그 — 이메일 마스킹', () => {
    w.completeAdminUser('tenant-1', {
      email: 'very-long@example.com',
      fullName: 'X',
    })
    const log = w.getAuditLog()
    const ev = log.find((e) => e.action === 'step.admin_user')
    expect(String(ev?.detail.emailMasked ?? '')).toContain('***')
  })
})
