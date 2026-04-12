import { describe, it, expect, beforeEach } from 'vitest';
import { MydataConsentPlatform, type ConsentScope } from '../mydata-consent-platform';

describe('MydataConsentPlatform', () => {
  let svc: MydataConsentPlatform;
  const scopes: ConsentScope[] = [
    { itemCode: 'name', itemName: '이름', purpose: '서비스 제공', enabled: true },
    { itemCode: 'email', itemName: '이메일', purpose: '마케팅', enabled: true },
  ];

  beforeEach(() => {
    svc = new MydataConsentPlatform();
  });

  it('FR-MD.1 동의 생성', () => {
    const r = svc.createConsent({ id: 'c1', subjectId: 's1', type: 'optional', scopes }, 'admin');
    expect(r.status).toBe('active');
    expect(r.scopes.length).toBe(2);
  });

  it('FR-MD.2 철회', () => {
    svc.createConsent({ id: 'c2', subjectId: 's1', type: 'optional', scopes }, 'admin');
    const r = svc.withdraw('c2', 'user');
    expect(r.status).toBe('withdrawn');
    expect(r.withdrawnAt).toBeDefined();
  });

  it('FR-MD.2 필수 동의 철회 금지', () => {
    svc.createConsent({ id: 'c3', subjectId: 's1', type: 'required', scopes }, 'admin');
    expect(() => svc.withdraw('c3', 'user')).toThrow();
  });

  it('FR-MD.3 동적 범위 토글', () => {
    svc.createConsent({ id: 'c4', subjectId: 's1', type: 'optional', scopes }, 'admin');
    const r = svc.toggleScope('c4', 'email', false, 'user');
    const email = r.scopes.find((s) => s.itemCode === 'email');
    expect(email?.enabled).toBe(false);
  });

  it('FR-MD.4 감사 로그 append-only', () => {
    svc.createConsent({ id: 'c5', subjectId: 's1', type: 'optional', scopes }, 'admin');
    svc.toggleScope('c5', 'email', false, 'user');
    const log = svc.getAuditLog('c5');
    expect(log.length).toBe(2);
    expect(log[0]!.action).toBe('create');
    expect(log[1]!.action).toBe('update');
  });

  it('FR-MD.5 권리 요청 라우팅', () => {
    const route = svc.routeDsr('access', 'c1');
    expect(route.handler).toBe('data-access-service');
  });
});
