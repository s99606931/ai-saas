/**
 * 공공 토지 이용 최적화 단위 테스트 — SVC-AI-ADV-R468
 * Plan SC: FR-468.1~6
 */

import { describe, it, expect } from 'vitest';
import { PublicLandUseOptimizer } from '../public-land-use-optimizer';

describe('PublicLandUseOptimizer — R468', () => {
  it('FR-468.3: restricted 토지는 변환 불가', () => {
    const o = new PublicLandUseOptimizer();
    const r = o.recommend({
      id: 'p1',
      areaSqm: 10000,
      accessScore: 1,
      demand: 'housing',
      currentUse: 'reserve',
      restricted: true,
    });
    expect(r.convertible).toBe(false);
    expect(r.recommendedUse).toBe('reserve');
  });

  it('FR-468.4: 고가치 토지 점수 계산', () => {
    const o = new PublicLandUseOptimizer();
    const r = o.recommend({
      id: 'p2',
      areaSqm: 10000,
      accessScore: 1,
      demand: 'housing',
      currentUse: 'idle',
      restricted: false,
    });
    // 50*1 + 30 + 20 = 100
    expect(r.utilityScore).toBe(100);
    expect(r.convertible).toBe(true);
  });

  it('FR-468.4: 소형 토지 areaPoints 15', () => {
    const o = new PublicLandUseOptimizer();
    const r = o.recommend({
      id: 'p3',
      areaSqm: 1000,
      accessScore: 0.5,
      demand: 'industry',
      currentUse: 'idle',
      restricted: false,
    });
    // 50*0.5 + 15 + 5 = 45
    expect(r.utilityScore).toBe(45);
    expect(r.convertible).toBe(false);
  });

  it('FR-468.1: invalid access score 거부', () => {
    const o = new PublicLandUseOptimizer();
    expect(() =>
      o.recommend({
        id: 'p',
        areaSqm: 100,
        accessScore: 2,
        demand: 'park',
        currentUse: 'idle',
        restricted: false,
      }),
    ).toThrow();
  });

  it('FR-468.6: C/S 차단 + audit log', () => {
    const o = new PublicLandUseOptimizer();
    expect(() =>
      o.recommend(
        { id: 'p', areaSqm: 100, accessScore: 0.5, demand: 'park', currentUse: 'idle', restricted: false },
        'C',
      ),
    ).toThrow(/N2SF_BLOCKED/);
    o.recommend({ id: 'p', areaSqm: 100, accessScore: 0.5, demand: 'park', currentUse: 'idle', restricted: false });
    expect(o.getAuditLog().length).toBeGreaterThan(0);
  });
});
