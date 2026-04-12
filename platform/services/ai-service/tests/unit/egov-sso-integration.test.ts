// MTU-N388 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  createAuthnRequest,
  computeSignatureStub,
  verifySignature,
  validateAssertion,
  createSession,
  findSession,
  getSsoAuditLog,
  EgovSsoIntegrationService,
  type SamlAssertion,
} from '../../src/lib/egov-sso-integration';

function mkAssertion(subject = 'user-1', audience = 'saas', expiryMs = 900_000): SamlAssertion {
  const assertionId = `a-${Date.now()}-${Math.random()}`;
  const issuer = 'egov-idp';
  return {
    assertionId,
    issuer,
    subject,
    audience,
    issueInstant: new Date().toISOString(),
    notOnOrAfter: new Date(Date.now() + expiryMs).toISOString(),
    attributes: { email: 'u@gov.kr' },
    signature: computeSignatureStub(assertionId, issuer, subject),
  };
}

describe('MTU-N388 EgovSsoIntegration', () => {
  it('AuthnRequest 생성', () => {
    const r = createAuthnRequest('saas', 'https://idp/sso', 'https://saas/acs');
    expect(r.requestId).toBeDefined();
    expect(r.issuer).toBe('saas');
  });

  it('서명 검증 통과', () => {
    const a = mkAssertion();
    expect(verifySignature(a)).toBe(true);
  });

  it('위조 서명 탐지', () => {
    const a = { ...mkAssertion(), signature: 'fake' };
    expect(verifySignature(a)).toBe(false);
  });

  it('Assertion 검증 - 정상', () => {
    const r = validateAssertion(mkAssertion(), 'saas');
    expect(r.valid).toBe(true);
  });

  it('Assertion 검증 - audience 불일치', () => {
    const r = validateAssertion(mkAssertion('u', 'other'), 'saas');
    expect(r.valid).toBe(false);
  });

  it('Assertion 검증 - 만료', () => {
    const a = mkAssertion();
    const pastAssertion = { ...a, notOnOrAfter: new Date(Date.now() - 1000).toISOString() };
    const r = validateAssertion(pastAssertion, 'saas');
    expect(r.valid).toBe(false);
  });

  it('Assertion 검증 - subject 누락', () => {
    const r = validateAssertion(mkAssertion(''), 'saas');
    expect(r.valid).toBe(false);
  });

  it('세션 생성', () => {
    const s = createSession('t1', mkAssertion());
    expect(s.userId).toBe('user-1');
  });

  it('세션 조회', () => {
    const s = createSession('t1', mkAssertion());
    expect(findSession(s.sessionId)?.userId).toBe('user-1');
  });

  it('만료된 세션 조회 불가', () => {
    const s = createSession('t1', mkAssertion(), 1);
    const future = Date.now() + 10_000;
    expect(findSession(s.sessionId, future)).toBeUndefined();
  });

  it('서비스 클래스', () => {
    const svc = new EgovSsoIntegrationService('t2');
    const s = svc.session(mkAssertion());
    expect(s.tenantId).toBe('t2');
  });

  it('감사 로그 테넌트 격리', () => {
    createSession('tA', mkAssertion('uA'));
    createSession('tB', mkAssertion('uB'));
    expect(getSsoAuditLog('tA').every((e) => e.tenantId === 'tA')).toBe(true);
  });
});
