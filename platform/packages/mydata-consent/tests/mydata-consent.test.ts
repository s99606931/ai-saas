// Test Ref: MTU-N455 §mydata-consent
// Plan SC: FR-MD.1 ~ FR-MD.5
import { describe, it, expect } from 'vitest';
import {
  ConsentManager,
  ConsentAuditLog,
  RightsRouter,
  type ConsentScope,
} from '../src/index.js';

const basicScopes: ConsentScope[] = [
  { dataCategory: 'identity', fields: ['name', 'dob'], required: true },
  { dataCategory: 'marketing', fields: ['email'], required: false },
];

describe('ConsentManager — FR-MD.1 생성/동의', () => {
  it('동의 생성 후 pending 상태', () => {
    const mgr = new ConsentManager();
    const c = mgr.create({
      subjectId: 's1',
      purpose: 'account_linking',
      scopes: basicScopes,
      actor: 's1',
    });
    expect(c.status).toBe('pending');
    expect(c.version).toBe(1);
  });

  it('동의 grant + TTL 만료', () => {
    const mgr = new ConsentManager();
    const c = mgr.create({ subjectId: 's1', purpose: 'p', scopes: basicScopes, actor: 's1' });
    const granted = mgr.grant(c.id, 's1', 1000);
    expect(granted.status).toBe('granted');
    expect(granted.grantedAt).toBeDefined();
    expect(granted.expiresAt).toBeDefined();
  });
});

describe('ConsentManager — FR-MD.2 철회', () => {
  it('철회 즉시 반영', () => {
    const mgr = new ConsentManager();
    const c = mgr.create({ subjectId: 's1', purpose: 'p', scopes: basicScopes, actor: 's1' });
    mgr.grant(c.id, 's1');
    const revoked = mgr.revoke(c.id, 's1', '사용자 요청');
    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedAt).toBeDefined();
    expect(mgr.effectiveScopes(c.id)).toEqual([]);
  });

  it('철회 후 재부여 금지', () => {
    const mgr = new ConsentManager();
    const c = mgr.create({ subjectId: 's1', purpose: 'p', scopes: basicScopes, actor: 's1' });
    mgr.grant(c.id, 's1');
    mgr.revoke(c.id, 's1');
    expect(() => mgr.grant(c.id, 's1')).toThrow();
  });
});

describe('ConsentManager — FR-MD.3 동적 범위 제어', () => {
  it('선택 항목 제거 허용', () => {
    const mgr = new ConsentManager();
    const c = mgr.create({ subjectId: 's1', purpose: 'p', scopes: basicScopes, actor: 's1' });
    mgr.grant(c.id, 's1');
    const modified = mgr.modifyScopes(
      c.id,
      [{ dataCategory: 'identity', fields: ['name'], required: true }],
      's1',
    );
    expect(modified.version).toBe(2);
    expect(modified.scopes.length).toBe(1);
  });

  it('필수 항목 제거 금지', () => {
    const mgr = new ConsentManager();
    const c = mgr.create({ subjectId: 's1', purpose: 'p', scopes: basicScopes, actor: 's1' });
    mgr.grant(c.id, 's1');
    expect(() =>
      mgr.modifyScopes(
        c.id,
        [{ dataCategory: 'marketing', fields: ['email'], required: false }],
        's1',
      ),
    ).toThrow(/required scopes/);
  });
});

describe('ConsentAuditLog — FR-MD.4 append-only', () => {
  it('모든 전이 이벤트 기록', () => {
    const mgr = new ConsentManager();
    const c = mgr.create({ subjectId: 's1', purpose: 'p', scopes: basicScopes, actor: 's1' });
    mgr.grant(c.id, 's1');
    mgr.modifyScopes(
      c.id,
      [{ dataCategory: 'identity', fields: ['name'], required: true }],
      's1',
    );
    mgr.revoke(c.id, 's1');
    const events = mgr.auditLog().listByConsent(c.id);
    expect(events.map((e) => e.type)).toEqual([
      'created',
      'granted',
      'modified',
      'revoked',
    ]);
  });

  it('이벤트 수정 불가 (freeze)', () => {
    const audit = new ConsentAuditLog();
    const e = audit.append({
      consentId: 'x',
      type: 'created',
      at: new Date().toISOString(),
      actor: 'u',
    });
    expect(() => {
      (e as unknown as { at: string }).at = 'tampered';
    }).toThrow();
  });

  it('만료 일괄 처리', () => {
    const mgr = new ConsentManager();
    const c = mgr.create({ subjectId: 's1', purpose: 'p', scopes: basicScopes, actor: 's1' });
    mgr.grant(c.id, 's1', 1);
    // 1ms 이후
    const expired = mgr.expireOverdue(new Date(Date.now() + 10));
    expect(expired.length).toBe(1);
    expect(expired[0].status).toBe('expired');
  });
});

describe('RightsRouter — FR-MD.5', () => {
  it('기본 라우팅 테이블', () => {
    const router = new RightsRouter();
    const req = router.route('delete', 's1');
    expect(req.routedTo).toBe('dpo-team');
    expect(req.subjectId).toBe('s1');
  });

  it('라우팅 테이블 재정의', () => {
    const router = new RightsRouter();
    router.setRoute('delete', 'compliance-team');
    expect(router.route('delete', 's1').routedTo).toBe('compliance-team');
  });
});
