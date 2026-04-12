import { describe, it, expect } from 'vitest';
import { PublicInfrastructureHealth, type InfrastructureAsset } from '../public-infrastructure-health.js';

const assets: InfrastructureAsset[] = [
  { id: 'a1', type: 'road', age: 5, maxAge: 50, usage: 100, maxUsage: 1000, damage: 0.1 },
  { id: 'a2', type: 'bridge', age: 45, maxAge: 50, usage: 900, maxUsage: 1000, damage: 0.8 },
  { id: 'a3', type: 'water', age: 20, maxAge: 40, usage: 500, maxUsage: 1000, damage: 0.3 },
];

describe('SVC-AI-ADV-R367 PublicInfrastructureHealth', () => {
  const svc = new PublicInfrastructureHealth();

  it('FR-367.1: 헬스 점수 계산', () => {
    const r = svc.assess(assets);
    expect(r.length).toBe(3);
    const a1 = r.find((x) => x.assetId === 'a1');
    expect(a1?.health).toBeGreaterThan(0.7);
  });

  it('FR-367.2: 우선순위 정렬 (HIGH 먼저)', () => {
    const r = svc.assess(assets);
    expect(r[0]?.priority).toBe('HIGH');
    expect(r[0]?.assetId).toBe('a2');
  });

  it('FR-367.3: C등급 차단', () => {
    expect(() => svc.assess(assets, 'C')).toThrow('N2SF_BLOCKED');
  });

  it('FR-367.4: 감사 로그', () => {
    svc.assess(assets);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('빈 배열 예외', () => {
    expect(() => svc.assess([])).toThrow('INVALID_PARAMS');
  });
});
