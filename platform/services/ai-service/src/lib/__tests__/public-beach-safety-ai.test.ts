import { describe, it, expect, beforeEach } from 'vitest';
import { PublicBeachSafetyAI, type BeachConditions } from '../public-beach-safety-ai';

const cond = (over: Partial<BeachConditions> = {}): BeachConditions => ({
  beachId: 'b1',
  waveHeightMeters: 0.8,
  ripCurrentRisk: 1,
  waterTempC: 23,
  windKph: 15,
  visitorCount: 300,
  lifeguardCount: 3,
  jellyfishAlert: false,
  ...over,
});

describe('PublicBeachSafetyAI', () => {
  let ai: PublicBeachSafetyAI;

  beforeEach(() => {
    ai = new PublicBeachSafetyAI();
  });

  it('양호한 조건 초록 깃발', () => {
    const d = ai.evaluate(cond());
    expect(d.flag).toBe('green');
    expect(d.allowSwim).toBe(true);
  });

  it('고파랑+이안류 검정 깃발', () => {
    const d = ai.evaluate(cond({ waveHeightMeters: 3.5, ripCurrentRisk: 5, windKph: 50 }));
    expect(d.flag).toBe('black');
    expect(d.allowSwim).toBe(false);
  });

  it('구조요원 부족 경고', () => {
    const d = ai.evaluate(cond({ visitorCount: 2000, lifeguardCount: 1 }));
    expect(d.warnings.some(w => w.includes('구조요원'))).toBe(true);
  });

  it('해파리 경보', () => {
    const d = ai.evaluate(cond({ jellyfishAlert: true }));
    expect(d.warnings.some(w => w.includes('해파리'))).toBe(true);
  });

  it('깃발 집계', () => {
    ai.evaluate(cond({ beachId: 'a' }));
    ai.evaluate(cond({ beachId: 'b', waveHeightMeters: 4, ripCurrentRisk: 5 }));
    const s = ai.summarizeByFlag();
    expect(s.green + s.yellow + s.red + s.black).toBe(2);
  });

  it('C등급 차단', () => {
    expect(() => ai.evaluate(cond(), 'C')).toThrow('BLOCKED');
  });
});
