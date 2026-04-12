// MTU-N388 전자정부 SSO 통합 테스트
import { describe, it, expect } from 'vitest';
import { EgovSsoIntegrationService, _signStub, type SamlAssertion } from '../egov-sso-integration.js';

describe('MTU-N388 EgovSsoIntegration', () => {
  const svc = new EgovSsoIntegrationService('tenant-n388');

  const makeAssertion = (subject: string, audience: string, valid: boolean, expired: boolean): SamlAssertion => {
    const assertionId = `a-${Date.now()}-${subject}`;
    const issuer = 'egov-idp';
    const signature = valid ? _signStub(assertionId, issuer, subject) : 'invalid';
    const notOnOrAfter = expired ? new Date(Date.now() - 1000).toISOString() : new Date(Date.now() + 60_000).toISOString();
    return {
      assertionId,
      issuer,
      subject,
      audience,
      issueInstant: new Date().toISOString(),
      notOnOrAfter,
      attributes: { name: '홍길동' },
      signature,
    };
  };

  it('FR-N388.1: AuthnRequest 생성', () => {
    const req = svc.authnRequest('sp', 'https://idp', 'https://sp/acs');
    expect(req.requestId).toBeDefined();
  });

  it('FR-N388.2: 유효한 assertion 검증', () => {
    const a = makeAssertion('user-1', 'saas', true, false);
    const result = svc.validate(a, 'saas');
    expect(result.valid).toBe(true);
  });

  it('FR-N388.3: 서명 위조 탐지', () => {
    const a = makeAssertion('user-2', 'saas', false, false);
    const result = svc.validate(a, 'saas');
    expect(result.valid).toBe(false);
  });

  it('FR-N388.4: 세션 생성 및 조회', () => {
    const a = makeAssertion('user-3', 'saas', true, false);
    const sess = svc.session(a);
    const found = svc.find(sess.sessionId);
    expect(found?.userId).toBe('user-3');
  });

  it('FR-N388.5: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
