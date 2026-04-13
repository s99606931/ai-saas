import { describe, it, expect, beforeEach } from 'vitest';
import { FederatedIdentityManagerAI } from '../federated-identity-manager-ai.js';

describe('SVC-AI-ADV-R402 FederatedIdentityManagerAI', () => {
  let svc: FederatedIdentityManagerAI;
  beforeEach(() => {
    svc = new FederatedIdentityManagerAI();
    svc.registerIssuer('gov-sso');
    svc.registerRoleMapping('gov-admin', ['tenant-admin', 'tenant-reader']);
  });

  it('FR-392.1: 유효 토큰 검증', () => {
    const r = svc.verifyToken({
      issuer: 'gov-sso',
      subject: 'u1',
      role: 'gov-admin',
      expiry: '2099-01-01T00:00:00Z',
    });
    expect(r.valid).toBe(true);
  });

  it('FR-392.2: 만료 토큰', () => {
    const r = svc.verifyToken({
      issuer: 'gov-sso',
      subject: 'u1',
      role: 'gov-admin',
      expiry: '2000-01-01T00:00:00Z',
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('EXPIRED');
  });

  it('FR-392.3: 비신뢰 issuer', () => {
    const r = svc.verifyToken({
      issuer: 'untrusted',
      subject: 'u1',
      role: 'gov-admin',
      expiry: '2099-01-01T00:00:00Z',
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('UNTRUSTED_ISSUER');
  });

  it('FR-392.4: 권한 전파', () => {
    const roles = svc.propagatePermissions('gov-admin');
    expect(roles).toEqual(['tenant-admin', 'tenant-reader']);
  });

  it('FR-392.5: 매핑 없을 시 guest', () => {
    const roles = svc.propagatePermissions('unknown-role');
    expect(roles).toEqual(['guest']);
  });

  it('감사 로그', () => {
    svc.verifyToken({
      issuer: 'gov-sso',
      subject: 'u1',
      role: 'gov-admin',
      expiry: '2099-01-01T00:00:00Z',
    });
    expect(svc.getAuditLog().some((e) => e.action === 'VERIFY_OK')).toBe(true);
  });
});
