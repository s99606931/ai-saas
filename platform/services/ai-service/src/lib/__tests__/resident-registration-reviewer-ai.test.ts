import { describe, it, expect } from 'vitest';
import { ResidentRegistrationReviewerAI } from '../resident-registration-reviewer-ai.js';

describe('SVC-AI-ADV-R431 ResidentRegistrationReviewerAI', () => {
  const svc = new ResidentRegistrationReviewerAI();
  const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  it('FR-431.4: 모든 요건 충족 → APPROVED', () => {
    const r = svc.review({
      name: '홍길동',
      rrn: '900101-1234567',
      address: '서울시 강남구',
      reason: '이사',
      evidenceCount: 2,
      lastChangeDate: oldDate,
    });
    expect(r.decision).toBe('APPROVED');
  });

  it('FR-431.1: 필수 필드 누락 → REJECTED', () => {
    const r = svc.review({
      name: '',
      rrn: '900101-1234567',
      address: '주소',
      reason: '이사',
      evidenceCount: 2,
      lastChangeDate: oldDate,
    });
    expect(r.decision).toBe('REJECTED');
    expect(r.reasons).toContain('MISSING_FIELD');
  });

  it('FR-431.2: 잘못된 주민번호 → REJECTED', () => {
    const r = svc.review({
      name: '홍길동',
      rrn: '1234567',
      address: '서울',
      reason: '이사',
      evidenceCount: 2,
      lastChangeDate: oldDate,
    });
    expect(r.decision).toBe('REJECTED');
    expect(r.reasons).toContain('INVALID_RRN');
  });

  it('FR-431.3: 30일 미경과 → HOLD', () => {
    const r = svc.review({
      name: '홍길동',
      rrn: '900101-1234567',
      address: '서울',
      reason: '이사',
      evidenceCount: 2,
      lastChangeDate: new Date().toISOString(),
    });
    expect(r.decision).toBe('HOLD');
  });

  it('증빙 부족 → HOLD', () => {
    const r = svc.review({
      name: '홍길동',
      rrn: '900101-1234567',
      address: '서울',
      reason: '이사',
      evidenceCount: 1,
      lastChangeDate: oldDate,
    });
    expect(r.decision).toBe('HOLD');
  });

  it('FR-431.5: S등급 차단', () => {
    expect(() =>
      svc.review(
        {
          name: '홍',
          rrn: '900101-1234567',
          address: '서울',
          reason: '이사',
          evidenceCount: 2,
          lastChangeDate: oldDate,
        },
        'S',
      ),
    ).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.review({
      name: '홍',
      rrn: '900101-1234567',
      address: '서울',
      reason: '이사',
      evidenceCount: 2,
      lastChangeDate: oldDate,
    });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
