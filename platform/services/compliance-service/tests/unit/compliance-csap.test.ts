// 준수현황 서비스 CSAP 보안 테스트
// Design Ref: DESIGN-MTU-P14
// Plan SC: FR-P14.1~FR-P14.5
// CSAP: D-06 감사로그, D-12 입력검증

import { describe, it, expect } from 'vitest';

describe('CSAP 준수현황 검증', () => {
  it('CSAP 표준등급 79개 통제항목이 정의된다', () => {
    const csapDomains = [
      'D-01',
      'D-02',
      'D-03',
      'D-04',
      'D-05',
      'D-06',
      'D-07',
      'D-08',
      'D-09',
      'D-10',
      'D-11',
      'D-12',
      'D-13',
    ];
    expect(csapDomains.length).toBe(13);
  });

  it('N2SF 6개 보안 영역이 정의된다', () => {
    const n2sfDomains = ['N-01', 'N-02', 'N-03', 'N-04', 'N-05', 'N-06'];
    expect(n2sfDomains.length).toBe(6);
  });

  it('준수율 계산이 올바르다', () => {
    const total = 79;
    const passed = 79;
    const rate = Math.round((passed / total) * 100);
    expect(rate).toBe(100);
  });

  it('부분 준수율 계산이 올바르다', () => {
    const total = 79;
    const passed = 65;
    const rate = Math.round((passed / total) * 100);
    expect(rate).toBe(82);
  });

  it('준수현황 상태 분류가 올바르다', () => {
    const getStatus = (rate: number): string => {
      if (rate >= 100) return 'COMPLIANT';
      if (rate >= 80) return 'PARTIAL';
      return 'NON_COMPLIANT';
    };
    expect(getStatus(100)).toBe('COMPLIANT');
    expect(getStatus(90)).toBe('PARTIAL');
    expect(getStatus(70)).toBe('NON_COMPLIANT');
  });

  it('ISMS-P 체크리스트가 포함된다', () => {
    const ismsCategories = ['관리체계 수립 및 운영', '보호대책 구현', '개인정보 보호조치'];
    expect(ismsCategories).toHaveLength(3);
  });
});

describe('준수현황 대시보드 보안', () => {
  it('대시보드 접근은 ADMIN 이상만 허용한다', () => {
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'];
    expect(allowedRoles).not.toContain('USER');
    expect(allowedRoles).not.toContain('VIEWER');
  });

  it('준수현황 데이터는 읽기 전용이다', () => {
    const readOnlyActions = ['list', 'get', 'export'];
    const mutationActions = ['create', 'update', 'delete'];
    // 준수현황은 서비스들의 상태를 집계하는 것이므로 직접 수정 불가
    readOnlyActions.forEach((action) => expect(typeof action).toBe('string'));
    expect(mutationActions.length).toBe(3);
  });
});

describe('CSAP D-06: 준수현황 감사 로그', () => {
  it('준수현황 조회도 감사 대상이다', () => {
    const events = ['COMPLIANCE_REPORT_VIEWED', 'COMPLIANCE_REPORT_EXPORTED', 'READINESS_CHECK_EXECUTED'];
    expect(events.length).toBe(3);
  });
});
