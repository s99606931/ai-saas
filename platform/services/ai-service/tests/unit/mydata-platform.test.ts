// MTU-N386 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  createConsent,
  revokeConsent,
  checkConsentValid,
  requestData,
  maskData,
  listConsents,
  getMydataAuditLog,
  MydataPlatformService,
} from '../../src/lib/mydata-platform';

describe('MTU-N386 MydataPlatform', () => {
  it('동의 생성', () => {
    const c = createConsent('t1', 'u1', ['income', 'family'], '연말정산');
    expect(c.status).toBe('active');
  });

  it('동의 철회', () => {
    const c = createConsent('t1', 'u1', ['income'], '테스트');
    revokeConsent('t1', c.consentId, 'u1');
    expect(checkConsentValid(c.consentId, 'income')).toBe(false);
  });

  it('타 사용자 철회 불가', () => {
    const c = createConsent('t1', 'u1', ['income'], '테스트');
    expect(() => revokeConsent('t1', c.consentId, 'u2')).toThrow(/권한/);
  });

  it('유효성 검사 - 활성', () => {
    const c = createConsent('t1', 'u1', ['address'], '배송');
    expect(checkConsentValid(c.consentId, 'address')).toBe(true);
  });

  it('유효성 검사 - 미포함 카테고리', () => {
    const c = createConsent('t1', 'u1', ['address'], '배송');
    expect(checkConsentValid(c.consentId, 'income')).toBe(false);
  });

  it('유효성 검사 - 만료', () => {
    const c = createConsent('t1', 'u1', ['x'], 'p', 0);
    // 만료 강제
    const future = Date.now() + 86400_000;
    expect(checkConsentValid(c.consentId, 'x', future)).toBe(false);
  });

  it('데이터 요청', () => {
    const c = createConsent('t1', 'u1', ['income'], '테스트');
    const r = requestData('t1', c.consentId, 'income');
    expect(r.category).toBe('income');
  });

  it('무효 동의 요청 실패', () => {
    expect(() => requestData('t1', 'unknown', 'income')).toThrow();
  });

  it('마스킹', () => {
    const masked = maskData({ name: '홍길동', age: 30 }, ['name']);
    expect(String(masked.name)).toContain('****');
  });

  it('짧은 값 마스킹', () => {
    const masked = maskData({ pw: 'abc' }, ['pw']);
    expect(masked.pw).toBe('****');
  });

  it('사용자 동의 목록', () => {
    createConsent('t1', 'u-list', ['a'], 'p');
    const list = listConsents('t1', 'u-list');
    expect(list.length).toBeGreaterThan(0);
  });

  it('서비스 클래스', () => {
    const svc = new MydataPlatformService('t2');
    const c = svc.create('u-s', ['a'], 'p');
    expect(c.userId).toBe('u-s');
  });

  it('감사 로그 테넌트 격리', () => {
    createConsent('tA', 'uA', ['x'], 'p');
    createConsent('tB', 'uB', ['x'], 'p');
    expect(getMydataAuditLog('tA').every((e) => e.tenantId === 'tA')).toBe(true);
  });
});
