// Feature Flags 테스트
// Plan SC: FR-FF.1~FR-FF.6

import { describe, it, expect } from 'vitest';
import { FeatureFlagManager, type FlagDefinition } from '../src/feature-flags.js';

describe('FR-FF.1: Boolean 플래그', () => {
  it('enabled=true → 활성화', () => {
    const mgr = new FeatureFlagManager([
      { name: 'new-ui', enabled: true },
    ]);
    expect(mgr.isEnabled('new-ui', { subjectId: 'user-1' })).toBe(true);
  });

  it('enabled=false → 비활성', () => {
    const mgr = new FeatureFlagManager([
      { name: 'broken', enabled: false },
    ]);
    expect(mgr.isEnabled('broken', { subjectId: 'user-1' })).toBe(false);
  });

  it('존재하지 않는 플래그는 false', () => {
    const mgr = new FeatureFlagManager();
    const result = mgr.evaluate('ghost', { subjectId: 'user-1' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('flag-not-found');
  });
});

describe('FR-FF.2: 퍼센트 롤아웃', () => {
  it('rollout=100 → 모두 활성', () => {
    const mgr = new FeatureFlagManager([
      { name: 'full', enabled: true, rollout: 100 },
    ]);
    for (let i = 0; i < 20; i++) {
      expect(mgr.isEnabled('full', { subjectId: `u${i}` })).toBe(true);
    }
  });

  it('rollout=0 → 아무도 활성 안됨', () => {
    const mgr = new FeatureFlagManager([
      { name: 'off', enabled: true, rollout: 0 },
    ]);
    for (let i = 0; i < 20; i++) {
      expect(mgr.isEnabled('off', { subjectId: `u${i}` })).toBe(false);
    }
  });

  it('rollout=50 → 약 절반', () => {
    const mgr = new FeatureFlagManager([
      { name: 'half', enabled: true, rollout: 50 },
    ]);
    let enabled = 0;
    for (let i = 0; i < 1000; i++) {
      if (mgr.isEnabled('half', { subjectId: `user-${i}` })) enabled++;
    }
    expect(enabled).toBeGreaterThan(400);
    expect(enabled).toBeLessThan(600);
  });

  it('동일 subject는 항상 동일 결과 (일관성)', () => {
    const mgr = new FeatureFlagManager([
      { name: 'consistent', enabled: true, rollout: 30 },
    ]);
    const first = mgr.isEnabled('consistent', { subjectId: 'same-user' });
    for (let i = 0; i < 10; i++) {
      expect(mgr.isEnabled('consistent', { subjectId: 'same-user' })).toBe(first);
    }
  });
});

describe('FR-FF.3: 세그먼트', () => {
  it('equals 연산자', () => {
    const mgr = new FeatureFlagManager([
      {
        name: 'vip',
        enabled: true,
        segments: [{ attribute: 'tier', operator: 'equals', value: 'gold' }],
      },
    ]);
    expect(
      mgr.isEnabled('vip', { subjectId: 'u1', attributes: { tier: 'gold' } }),
    ).toBe(true);
    expect(
      mgr.isEnabled('vip', { subjectId: 'u1', attributes: { tier: 'silver' } }),
    ).toBe(false);
  });

  it('in 연산자', () => {
    const mgr = new FeatureFlagManager([
      {
        name: 'regional',
        enabled: true,
        segments: [
          { attribute: 'region', operator: 'in', value: ['seoul', 'busan'] },
        ],
      },
    ]);
    expect(
      mgr.isEnabled('regional', {
        subjectId: 'u1',
        attributes: { region: 'seoul' },
      }),
    ).toBe(true);
    expect(
      mgr.isEnabled('regional', {
        subjectId: 'u1',
        attributes: { region: 'daegu' },
      }),
    ).toBe(false);
  });

  it('startsWith 연산자', () => {
    const mgr = new FeatureFlagManager([
      {
        name: 'org',
        enabled: true,
        segments: [
          { attribute: 'email', operator: 'startsWith', value: 'admin@' },
        ],
      },
    ]);
    expect(
      mgr.isEnabled('org', {
        subjectId: 'u1',
        attributes: { email: 'admin@gov.kr' },
      }),
    ).toBe(true);
  });

  it('allowList 우선 (deny-list보다 뒤에서 평가됨)', () => {
    const mgr = new FeatureFlagManager([
      {
        name: 'beta',
        enabled: true,
        allowList: ['beta-tester-1'],
        rollout: 0,
      },
    ]);
    expect(mgr.isEnabled('beta', { subjectId: 'beta-tester-1' })).toBe(true);
    expect(mgr.isEnabled('beta', { subjectId: 'other' })).toBe(false);
  });

  it('denyList는 최우선 차단', () => {
    const mgr = new FeatureFlagManager([
      {
        name: 'public',
        enabled: true,
        denyList: ['banned-user'],
        rollout: 100,
      },
    ]);
    expect(mgr.isEnabled('public', { subjectId: 'banned-user' })).toBe(false);
    expect(mgr.isEnabled('public', { subjectId: 'normal' })).toBe(true);
  });
});

describe('FR-FF.4: 동적 업데이트', () => {
  it('setFlag로 실시간 변경', () => {
    const mgr = new FeatureFlagManager();
    mgr.setFlag({ name: 'x', enabled: false });
    expect(mgr.isEnabled('x', { subjectId: 'u' })).toBe(false);

    mgr.setFlag({ name: 'x', enabled: true });
    expect(mgr.isEnabled('x', { subjectId: 'u' })).toBe(true);
  });

  it('잘못된 rollout 거부', () => {
    const mgr = new FeatureFlagManager();
    expect(() =>
      mgr.setFlag({ name: 'bad', enabled: true, rollout: 150 }),
    ).toThrow();
  });

  it('removeFlag', () => {
    const mgr = new FeatureFlagManager([
      { name: 'temp', enabled: true },
    ]);
    expect(mgr.removeFlag('temp')).toBe(true);
    expect(mgr.getFlag('temp')).toBeUndefined();
  });
});

describe('FR-FF.5: 평가 로그', () => {
  it('평가 결과 기록', () => {
    const mgr = new FeatureFlagManager([
      { name: 'f1', enabled: true },
      { name: 'f2', enabled: false },
    ]);
    mgr.isEnabled('f1', { subjectId: 'u1' });
    mgr.isEnabled('f2', { subjectId: 'u1' });

    const log = mgr.getEvaluationLog();
    expect(log).toHaveLength(2);
    expect(log[0]!.reason).toBe('default-on');
    expect(log[1]!.reason).toBe('master-disabled');
  });
});

describe('FR-FF.6: JSON 로드', () => {
  it('JSON 배열에서 플래그 로드', () => {
    const mgr = new FeatureFlagManager();
    const json = JSON.stringify([
      { name: 'a', enabled: true },
      { name: 'b', enabled: false },
    ]);
    const count = mgr.loadFromJson(json);
    expect(count).toBe(2);
    expect(mgr.listFlags()).toHaveLength(2);
  });

  it('배열이 아니면 거부', () => {
    const mgr = new FeatureFlagManager();
    expect(() => mgr.loadFromJson('{"name":"x"}')).toThrow();
  });
});
