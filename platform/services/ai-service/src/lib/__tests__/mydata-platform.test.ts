// MTU-N386 마이데이터 플랫폼 테스트
import { describe, it, expect } from 'vitest';
import { MydataPlatformService } from '../mydata-platform.js';

describe('MTU-N386 MydataPlatform', () => {
  const svc = new MydataPlatformService('tenant-n386');

  it('FR-N386.1: 동의 생성', () => {
    const consent = svc.create('user-1', ['건강', '금융'], '의료 상담', 30);
    expect(consent.status).toBe('active');
    expect(consent.dataCategories).toContain('건강');
  });

  it('FR-N386.2: 데이터 요청 및 동의 검증', () => {
    const consent = svc.create('user-2', ['주소'], '배송', 30);
    const req = svc.request(consent.consentId, '주소');
    expect(req.category).toBe('주소');
  });

  it('FR-N386.3: 동의 철회 후 차단', () => {
    const consent = svc.create('user-3', ['위치'], '분석', 30);
    svc.revoke(consent.consentId, 'user-3');
    expect(() => svc.request(consent.consentId, '위치')).toThrow();
  });

  it('FR-N386.4: 개인정보 마스킹', () => {
    const masked = svc.mask({ name: '홍길동', phone: '01012345678' }, ['phone']);
    expect(masked.phone).not.toBe('01012345678');
  });

  it('FR-N386.5: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
