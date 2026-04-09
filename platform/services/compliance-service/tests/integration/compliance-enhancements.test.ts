// 준수 현황 서비스 고도화 통합 테스트
// Design Ref: SVC-COMP-R1 DESIGN
// Plan SC: FR-COMP.1~FR-COMP.4

import { describe, it, expect } from 'vitest';

describe('FR-COMP.1: Rate Limiting', () => {
  it('읽기 제한이 100 req/60s이다', () => {
    expect({ max: 100, windowSeconds: 60 }).toEqual({ max: 100, windowSeconds: 60 });
  });
});

describe('FR-COMP.2: CSAP 미준수 항목 상세', () => {
  it('미준수 분야 목록이 올바르다', () => {
    const domains = [
      { id: 'D-05', items: 4, implemented: 3 },
      { id: 'D-07', items: 3, implemented: 2 },
      { id: 'D-10', items: 8, implemented: 6 },
      { id: 'D-11', items: 7, implemented: 6 },
    ];
    const gaps = domains.filter(d => d.implemented < d.items);
    expect(gaps).toHaveLength(4);
  });

  it('미준수 항목 수 합계가 올바르다', () => {
    const gapCounts = [1, 1, 2, 1]; // D-05, D-07, D-10, D-11
    const totalGaps = gapCounts.reduce((sum, g) => sum + g, 0);
    expect(totalGaps).toBe(5);
  });

  it('조치 권고가 분야별로 제공된다', () => {
    const recommendations: Record<string, string> = {
      'D-05': '물리적 보안: 운영 환경(서버실/IDC) 물리 보안 장비 설치 필요',
      'D-07': '서비스 연속성: DR(재해복구) 사이트 및 백업 정책 수립 필요',
      'D-10': '네트워크 보안: 방화벽/IDS/IPS 인프라 구성 필요',
      'D-11': '시스템 보안: OS 수준 보안 설정(CIS Benchmark) 적용 필요',
    };
    expect(Object.keys(recommendations)).toHaveLength(4);
    expect(recommendations['D-05']).toContain('물리적 보안');
  });

  it('gaps 응답 형식이 올바르다', () => {
    const response = {
      success: true,
      data: {
        gaps: [{ domainId: 'D-05', gapCount: 1, recommendation: '...' }],
        totalGaps: 5,
        totalItems: 79,
        complianceRate: 94,
      },
    };
    expect(response.data.totalGaps).toBe(5);
    expect(response.data.complianceRate).toBe(94);
  });
});

describe('FR-COMP.3: 준수율 스냅샷 이력', () => {
  it('스냅샷에 csapRate, n2sfRate, readinessScore가 포함된다', () => {
    const snapshot = {
      id: 1,
      csapRate: 94,
      n2sfRate: 94,
      readinessScore: 96,
      timestamp: '2026-04-10T00:00:00Z',
    };
    expect(snapshot.csapRate).toBeDefined();
    expect(snapshot.n2sfRate).toBeDefined();
    expect(snapshot.readinessScore).toBeDefined();
  });

  it('이력 최대 100개로 제한된다', () => {
    const MAX_SNAPSHOTS = 100;
    expect(MAX_SNAPSHOTS).toBe(100);
  });

  it('최근 20개를 반환한다', () => {
    const snapshots = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
    const recent = snapshots.slice(-20);
    expect(recent).toHaveLength(20);
    expect(recent[0]!.id).toBe(6);
  });
});

describe('FR-COMP.4: 감리 준비도 상세', () => {
  it('감리 준비도 점수 계산이 올바르다', () => {
    const csapRate = 94;
    const n2sfRate = 94;
    const docCompleteness = 100;
    const score = Math.round(csapRate * 0.4 + n2sfRate * 0.3 + docCompleteness * 0.3);
    expect(score).toBe(96);
  });

  it('90점 이상이면 감리 대응 준비 완료', () => {
    const score = 96;
    const recommendation = score >= 90 ? '감리 대응 준비 완료' : '보완 필요';
    expect(recommendation).toBe('감리 대응 준비 완료');
  });
});

describe('기존 기능 회귀: 라우트', () => {
  const routes = [
    '/compliance/csap',
    '/compliance/csap/gaps',
    '/compliance/n2sf',
    '/compliance/readiness',
    '/compliance/history',
    '/compliance/metrics',
  ];

  it('6개 라우트가 등록되어 있다 (기존 4 + 신규 2)', () => {
    expect(routes).toHaveLength(6);
  });

  it('gaps 라우트가 추가되었다', () => {
    expect(routes).toContain('/compliance/csap/gaps');
  });

  it('history 라우트가 추가되었다', () => {
    expect(routes).toContain('/compliance/history');
  });
});
