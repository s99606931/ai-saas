/**
 * 마이데이터 동의 관리 테스트
 * Plan SC: FR-MD.1~5
 */

import { ConsentManager, ConsentAuditLog } from '../src/mydata-consent';

describe('ConsentAuditLog', () => {
  it('append + history (append-only)', () => {
    const log = new ConsentAuditLog();
    log.append({
      eventId: 'e1',
      consentId: 'c1',
      type: 'created',
      timestamp: '2026-04-12',
      actor: 'admin',
    });
    log.append({
      eventId: 'e2',
      consentId: 'c2',
      type: 'created',
      timestamp: '2026-04-12',
      actor: 'admin',
    });
    expect(log.history('c1').length).toBe(1);
    expect(log.all().length).toBe(2);
  });

  it('history는 deep copy 반환 (외부 변경 차단)', () => {
    const log = new ConsentAuditLog();
    log.append({
      eventId: 'e1',
      consentId: 'c1',
      type: 'created',
      timestamp: '',
      actor: 'a',
    });
    const list = log.history('c1');
    if (list[0]) list[0].actor = 'tampered';
    expect(log.history('c1')[0]?.actor).toBe('a');
  });
});

describe('ConsentManager', () => {
  let mgr: ConsentManager;
  beforeEach(() => {
    mgr = new ConsentManager();
  });

  it('create: 유효기간 + 감사로그 생성', () => {
    const record = mgr.create({
      consentId: 'c1',
      subjectId: 's1',
      purpose: '서비스이용',
      scopes: [
        { fieldId: 'name', mandatory: true, granted: true },
        { fieldId: 'phone', mandatory: false, granted: true },
      ],
      validityDays: 365,
      actor: 'system',
    });
    expect(record.consentId).toBe('c1');
    expect(record.scopes.length).toBe(2);
    const audit = mgr.getAuditLog().history('c1');
    expect(audit[0]?.type).toBe('created');
  });

  it('updateScope: 선택 동의 부분 철회', () => {
    mgr.create({
      consentId: 'c1',
      subjectId: 's1',
      purpose: '서비스이용',
      scopes: [{ fieldId: 'phone', mandatory: false, granted: true }],
      validityDays: 365,
      actor: 'system',
    });
    mgr.updateScope('c1', 'phone', false, 'user1');
    const r = mgr.get('c1');
    expect(r?.scopes.find((s) => s.fieldId === 'phone')?.granted).toBe(false);
  });

  it('updateScope: 필수 동의 철회 시 오류', () => {
    mgr.create({
      consentId: 'c1',
      subjectId: 's1',
      purpose: '서비스이용',
      scopes: [{ fieldId: 'name', mandatory: true, granted: true }],
      validityDays: 365,
      actor: 'system',
    });
    expect(() => mgr.updateScope('c1', 'name', false, 'u')).toThrow(/필수 동의/);
  });

  it('updateScope: 미존재 fieldId 시 오류', () => {
    mgr.create({
      consentId: 'c1',
      subjectId: 's1',
      purpose: '서비스이용',
      scopes: [{ fieldId: 'name', mandatory: true, granted: true }],
      validityDays: 365,
      actor: 'system',
    });
    expect(() => mgr.updateScope('c1', 'unknown', false, 'u')).toThrow(/범위 없음/);
  });

  it('revoke: 전체 철회 시 비필수 모두 false', () => {
    mgr.create({
      consentId: 'c1',
      subjectId: 's1',
      purpose: '서비스이용',
      scopes: [
        { fieldId: 'name', mandatory: true, granted: true },
        { fieldId: 'phone', mandatory: false, granted: true },
      ],
      validityDays: 365,
      actor: 'system',
    });
    mgr.revoke('c1', 'user');
    const r = mgr.get('c1');
    expect(r?.revokedAt).not.toBeNull();
    expect(r?.scopes.find((s) => s.fieldId === 'phone')?.granted).toBe(false);
    // 필수는 그대로
    expect(r?.scopes.find((s) => s.fieldId === 'name')?.granted).toBe(true);
  });

  it('revoke: 이미 철회된 동의 재호출 시 idempotent', () => {
    mgr.create({
      consentId: 'c1',
      subjectId: 's1',
      purpose: '서비스이용',
      scopes: [{ fieldId: 'name', mandatory: true, granted: true }],
      validityDays: 365,
      actor: 'system',
    });
    mgr.revoke('c1', 'user');
    expect(() => mgr.revoke('c1', 'user')).not.toThrow();
  });

  it('canProcess: 활성 동의 + 만료 전이면 true', () => {
    mgr.create({
      consentId: 'c1',
      subjectId: 's1',
      purpose: '서비스이용',
      scopes: [{ fieldId: 'phone', mandatory: false, granted: true }],
      validityDays: 365,
      actor: 'system',
    });
    expect(mgr.canProcess('c1', 'phone')).toBe(true);
  });

  it('canProcess: 미존재 동의는 false', () => {
    expect(mgr.canProcess('nope', 'phone')).toBe(false);
  });

  it('canProcess: 만료된 동의는 false', () => {
    mgr.create({
      consentId: 'c1',
      subjectId: 's1',
      purpose: '서비스이용',
      scopes: [{ fieldId: 'phone', mandatory: false, granted: true }],
      validityDays: 1,
      actor: 'system',
    });
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    expect(mgr.canProcess('c1', 'phone', future)).toBe(false);
  });

  it('canProcess: 철회된 동의는 false', () => {
    mgr.create({
      consentId: 'c1',
      subjectId: 's1',
      purpose: '서비스이용',
      scopes: [{ fieldId: 'phone', mandatory: false, granted: true }],
      validityDays: 365,
      actor: 'system',
    });
    mgr.revoke('c1', 'user');
    expect(mgr.canProcess('c1', 'phone')).toBe(false);
  });

  it('updateScope on revoked → 오류', () => {
    mgr.create({
      consentId: 'c1',
      subjectId: 's1',
      purpose: '서비스이용',
      scopes: [{ fieldId: 'phone', mandatory: false, granted: true }],
      validityDays: 365,
      actor: 'system',
    });
    mgr.revoke('c1', 'user');
    expect(() => mgr.updateScope('c1', 'phone', true, 'user')).toThrow(/이미 철회/);
  });

  it('updateScope on missing → 오류', () => {
    expect(() => mgr.updateScope('nope', 'phone', false, 'u')).toThrow(/동의 기록 없음/);
  });

  it('생성자 주입 auditLog 사용', () => {
    const customLog = new ConsentAuditLog();
    const mgr2 = new ConsentManager(customLog);
    mgr2.create({
      consentId: 'c1',
      subjectId: 's1',
      purpose: '서비스이용',
      scopes: [{ fieldId: 'name', mandatory: true, granted: true }],
      validityDays: 365,
      actor: 'system',
    });
    expect(customLog.all().length).toBe(1);
  });
});
