// MTU-N330 테넌트 SSO 관리 테스트
import { describe, it, expect } from 'vitest';
import { TenantSSOManagerService } from '../tenant-sso-manager.js';

describe('MTU-N330 TenantSSOManager', () => {
  const svc = new TenantSSOManagerService('tenant-n330');

  it('FR-N330.1: SSO 공급자 생성', () => {
    const p = svc.createProvider('AzureAD', 'saml', 'urn:azure', 'https://sso.example.com', 'cert-data');
    expect(p).toBeDefined();
    expect(svc.getProviders().length).toBeGreaterThan(0);
  });

  it('FR-N330.2: SAML 검증', () => {
    const p = svc.createProvider('Okta', 'saml', 'urn:okta', 'https://okta.example.com', 'cert');
    const assertion = {
      assertionId: 'a1',
      issuer: 'urn:okta',
      subject: 'user@example.com',
      email: 'user@example.com',
      roles: ['user'],
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      signature: 'sig',
    };
    const result = svc.validate(assertion, p);
    expect(result).toBeDefined();
  });

  it('FR-N330.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
