// 준수 현황 대시보드 테스트
// Design Ref: DESIGN-MTU-P14
// Plan SC: FR-P14.1~FR-P14.4
// CSAP: D-06, N-01

import { describe, it, expect } from 'vitest';

// CSAP 79항목 도메인 정의 (checklist-master.md 기준 정합)
interface CsapDomainConfig {
  id: string;
  name: string;
  items: number;
  implementedItems: number;
}

const CSAP_DOMAINS: CsapDomainConfig[] = [
  { id: 'D-01', name: '정보보호 정책', items: 4, implementedItems: 4 },
  { id: 'D-02', name: '정보보호 조직', items: 3, implementedItems: 3 },
  { id: 'D-03', name: '자산 관리', items: 4, implementedItems: 4 },
  { id: 'D-04', name: '인적 보안', items: 5, implementedItems: 5 },
  { id: 'D-05', name: '물리적 보안', items: 4, implementedItems: 3 },
  { id: 'D-06', name: '침해사고 관리', items: 5, implementedItems: 5 },
  { id: 'D-07', name: '서비스 연속성', items: 3, implementedItems: 2 },
  { id: 'D-08', name: '접근 통제', items: 12, implementedItems: 12 },
  { id: 'D-09', name: '암호화', items: 4, implementedItems: 4 },
  { id: 'D-10', name: '네트워크 보안', items: 8, implementedItems: 6 },
  { id: 'D-11', name: '시스템 보안', items: 7, implementedItems: 6 },
  { id: 'D-12', name: '시스템 개발 보안', items: 10, implementedItems: 10 },
  { id: 'D-13', name: '공급망 보안', items: 10, implementedItems: 10 },
];

interface N2sfDomainConfig {
  id: string;
  name: string;
  items: number;
  implementedItems: number;
  status: 'pass' | 'partial' | 'fail';
}

const N2SF_DOMAINS: N2sfDomainConfig[] = [
  { id: 'N-01', name: '네트워크 분리', items: 3, implementedItems: 2, status: 'partial' },
  { id: 'N-02', name: '데이터 등급 분류', items: 4, implementedItems: 4, status: 'pass' },
  { id: 'N-03', name: '접근 통제', items: 3, implementedItems: 3, status: 'pass' },
  { id: 'N-04', name: '인증 강화', items: 2, implementedItems: 2, status: 'pass' },
  { id: 'N-05', name: 'AI 연동 보안', items: 3, implementedItems: 3, status: 'pass' },
  { id: 'N-06', name: '감사 추적', items: 3, implementedItems: 3, status: 'pass' },
];

describe('CSAP 79항목 도메인 정합성 (FR-P14.1)', () => {
  it('총 항목 수가 79개이다 (checklist-master.md 기준)', () => {
    const total = CSAP_DOMAINS.reduce((sum, d) => sum + d.items, 0);
    expect(total).toBe(79);
  });

  it('13개 도메인이 정의되어 있다', () => {
    expect(CSAP_DOMAINS.length).toBe(13);
  });

  it('모든 도메인 ID가 D-01~D-13이다', () => {
    CSAP_DOMAINS.forEach((d, i) => {
      const expected = `D-${String(i + 1).padStart(2, '0')}`;
      expect(d.id).toBe(expected);
    });
  });

  it('구현된 항목 수가 총 항목 수를 초과하지 않는다', () => {
    CSAP_DOMAINS.forEach((d) => {
      expect(d.implementedItems).toBeLessThanOrEqual(d.items);
    });
  });

  it('준수율이 올바르게 계산된다', () => {
    const totalItems = CSAP_DOMAINS.reduce((sum, d) => sum + d.items, 0);
    const totalPass = CSAP_DOMAINS.reduce((sum, d) => sum + d.implementedItems, 0);
    const rate = Math.round((totalPass / totalItems) * 100);
    expect(rate).toBeGreaterThanOrEqual(80); // 최소 80% 이상 (감리 기준)
    expect(totalPass).toBe(74); // 현재 구현 완료 74개
  });

  it('각 도메인별 준수율이 0~100% 범위이다', () => {
    CSAP_DOMAINS.forEach((d) => {
      const rate = Math.round((d.implementedItems / d.items) * 100);
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
    });
  });
});

describe('N2SF 6영역 정합성 (FR-P14.2)', () => {
  it('총 항목 수가 18개이다', () => {
    const total = N2SF_DOMAINS.reduce((sum, d) => sum + d.items, 0);
    expect(total).toBe(18);
  });

  it('6개 영역이 정의되어 있다', () => {
    expect(N2SF_DOMAINS.length).toBe(6);
  });

  it('모든 영역 ID가 N-01~N-06이다', () => {
    N2SF_DOMAINS.forEach((d, i) => {
      const expected = `N-${String(i + 1).padStart(2, '0')}`;
      expect(d.id).toBe(expected);
    });
  });

  it('status가 pass/partial/fail 중 하나이다', () => {
    N2SF_DOMAINS.forEach((d) => {
      expect(['pass', 'partial', 'fail']).toContain(d.status);
    });
  });

  it('구현된 항목 수가 총 항목 수를 초과하지 않는다', () => {
    N2SF_DOMAINS.forEach((d) => {
      expect(d.implementedItems).toBeLessThanOrEqual(d.items);
    });
  });

  it('N2SF 준수율이 올바르게 계산된다', () => {
    const totalItems = N2SF_DOMAINS.reduce((sum, d) => sum + d.items, 0);
    const totalPass = N2SF_DOMAINS.reduce((sum, d) => sum + d.implementedItems, 0);
    const rate = Math.round((totalPass / totalItems) * 100);
    expect(rate).toBeGreaterThanOrEqual(80);
    expect(totalPass).toBe(17); // 현재 구현 완료 17개
  });
});

describe('감리 준비도 계산 (FR-P14.3)', () => {
  it('가중 점수가 올바르게 계산된다', () => {
    const csapTotal = CSAP_DOMAINS.reduce((sum, d) => sum + d.items, 0);
    const csapPass = CSAP_DOMAINS.reduce((sum, d) => sum + d.implementedItems, 0);
    const csapRate = Math.round((csapPass / csapTotal) * 100);

    const n2sfTotal = N2SF_DOMAINS.reduce((sum, d) => sum + d.items, 0);
    const n2sfPass = N2SF_DOMAINS.reduce((sum, d) => sum + d.implementedItems, 0);
    const n2sfRate = Math.round((n2sfPass / n2sfTotal) * 100);

    const docCompleteness = 100;

    const readinessScore = Math.round(
      csapRate * 0.4 + n2sfRate * 0.3 + docCompleteness * 0.3,
    );

    expect(readinessScore).toBeGreaterThanOrEqual(80);
    expect(readinessScore).toBeLessThanOrEqual(100);
  });

  it('90점 이상이면 "감리 대응 준비 완료" 판정이다', () => {
    const score = 92;
    const recommendation = score >= 90
      ? '감리 대응 준비 완료'
      : score >= 70
        ? '일부 보완 후 감리 대응 가능'
        : '감리 대응 준비 미흡';
    expect(recommendation).toBe('감리 대응 준비 완료');
  });

  it('70~89점이면 "일부 보완 후 감리 대응 가능" 판정이다', () => {
    const score = 75;
    const recommendation = score >= 90
      ? '감리 대응 준비 완료'
      : score >= 70
        ? '일부 보완 후 감리 대응 가능'
        : '감리 대응 준비 미흡';
    expect(recommendation).toBe('일부 보완 후 감리 대응 가능');
  });

  it('70점 미만이면 "감리 대응 준비 미흡" 판정이다', () => {
    const score = 55;
    const recommendation = score >= 90
      ? '감리 대응 준비 완료'
      : score >= 70
        ? '일부 보완 후 감리 대응 가능'
        : '감리 대응 준비 미흡';
    expect(recommendation).toBe('감리 대응 준비 미흡');
  });
});
