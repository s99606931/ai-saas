import { describe, it, expect } from 'vitest';
import { DisasterPreAlertIssuerAI } from '../disaster-pre-alert-issuer-ai.js';

describe('SVC-AI-ADV-R438 DisasterPreAlertIssuerAI', () => {
  const svc = new DisasterPreAlertIssuerAI();

  it('FR-438.2: RAINFALL SEVERE', () => {
    const a = svc.issue({ kind: 'RAINFALL', metric: 120 });
    expect(a.level).toBe('SEVERE');
    expect(a.threshold).toBe(100);
  });

  it('FR-438.2: SEISMIC WARNING', () => {
    const a = svc.issue({ kind: 'SEISMIC', metric: 5.2 });
    expect(a.level).toBe('WARNING');
  });

  it('FR-438.2: FLOOD CAUTION', () => {
    const a = svc.issue({ kind: 'FLOOD', metric: 2.5 });
    expect(a.level).toBe('CAUTION');
  });

  it('임계값 미달 → NONE', () => {
    const a = svc.issue({ kind: 'RAINFALL', metric: 5 });
    expect(a.level).toBe('NONE');
  });

  it('FR-438.3: 알 수 없는 kind → 오류', () => {
    expect(() => svc.issue({ kind: 'UFO' as 'RAINFALL', metric: 10 })).toThrow('UNKNOWN_KIND');
  });

  it('음수 metric → 오류', () => {
    expect(() => svc.issue({ kind: 'FLOOD', metric: -1 })).toThrow('INVALID_METRIC');
  });

  it('FR-438.5: S 차단', () => {
    expect(() => svc.issue({ kind: 'RAINFALL', metric: 10 }, 'S')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.issue({ kind: 'RAINFALL', metric: 50 });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
