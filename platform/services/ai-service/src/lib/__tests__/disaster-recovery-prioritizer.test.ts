import { describe, it, expect } from 'vitest';
import { DisasterRecoveryPrioritizer } from '../disaster-recovery-prioritizer.js';

describe('SVC-AI-ADV-R454 DisasterRecoveryPrioritizer', () => {
  const svc = new DisasterRecoveryPrioritizer();

  it('FR-454.4: 순위 내림차순', () => {
    const r = svc.prioritize([
      {
        id: 'f1',
        type: 'school',
        damage: 0.3,
        residents: 500,
        criticality: 'low',
      },
      {
        id: 'f2',
        type: 'hospital',
        damage: 0.9,
        residents: 5000,
        criticality: 'high',
      },
    ]);
    expect(r[0]!.id).toBe('f2');
    expect(r[0]!.rank).toBe(1);
  });

  it('FR-454.5: URGENT 태그', () => {
    const r = svc.prioritize([
      {
        id: 'f1',
        type: 'hospital',
        damage: 0.85,
        residents: 2000,
        criticality: 'high',
      },
    ]);
    expect(r[0]!.urgent).toBe(true);
  });

  it('FR-454.5: URGENT 미해당', () => {
    const r = svc.prioritize([
      {
        id: 'f1',
        type: 'school',
        damage: 0.85,
        residents: 2000,
        criticality: 'med',
      },
    ]);
    expect(r[0]!.urgent).toBe(false);
  });

  it('FR-454.3: 주민 수 상한', () => {
    const r = svc.prioritize([
      {
        id: 'f1',
        type: 'apt',
        damage: 0,
        residents: 999999,
        criticality: 'low',
      },
    ]);
    // residents part 최대 0.3, crit low 0.1 → 0.4
    expect(r[0]!.score).toBe(0.4);
  });

  it('damage 범위 오류', () => {
    expect(() =>
      svc.prioritize([
        {
          id: 'f1',
          type: 't',
          damage: 1.5,
          residents: 100,
          criticality: 'low',
        },
      ]),
    ).toThrow('INVALID_DAMAGE');
  });

  it('residents 음수 오류', () => {
    expect(() =>
      svc.prioritize([
        {
          id: 'f1',
          type: 't',
          damage: 0.5,
          residents: -1,
          criticality: 'low',
        },
      ]),
    ).toThrow('INVALID_RESIDENTS');
  });

  it('FR-454.6: C 차단', () => {
    expect(() => svc.prioritize([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.prioritize([]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
