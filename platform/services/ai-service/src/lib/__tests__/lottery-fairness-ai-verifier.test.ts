import { describe, it, expect, beforeEach } from 'vitest';
import { LotteryFairnessAIVerifier } from '../lottery-fairness-ai-verifier';

describe('LotteryFairnessAIVerifier', () => {
  let ai: LotteryFairnessAIVerifier;

  beforeEach(() => {
    ai = new LotteryFairnessAIVerifier();
  });

  it('추첨 결과를 기록한다', () => {
    ai.recordDraw({
      drawId: 'd1',
      candidates: ['A', 'B', 'C', 'D'],
      winners: ['A', 'B'],
      seedHash: 'h1',
    });
    expect(ai.getFrequency('A')).toBe(1);
  });

  it('엔트로피를 계산한다', () => {
    ai.recordDraw({
      drawId: 'd1',
      candidates: ['A', 'B', 'C', 'D'],
      winners: ['A', 'B', 'C', 'D'],
      seedHash: 'h',
    });
    const h = ai.computeEntropy('d1');
    expect(h).toBeGreaterThan(1.9);
  });

  it('카이제곱 통계량을 계산한다', () => {
    ai.recordDraw({
      drawId: 'd1',
      candidates: ['A', 'B', 'C', 'D'],
      winners: ['A', 'A', 'A', 'A'],
      seedHash: 'h',
    });
    const chi = ai.chiSquareTest('d1');
    expect(chi).toBeGreaterThan(0);
  });

  it('공정성을 검증한다', () => {
    ai.recordDraw({
      drawId: 'd1',
      candidates: ['A', 'B', 'C', 'D'],
      winners: ['A', 'B', 'C', 'D'],
      seedHash: 'h',
    });
    const report = ai.verify('d1');
    expect(report.verdict).toBe('fair');
  });

  it('후보자 외 당첨자는 거부한다', () => {
    expect(() =>
      ai.recordDraw({ drawId: 'd1', candidates: ['A'], winners: ['Z'], seedHash: 'h' }),
    ).toThrow('후보자');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.recordDraw(
        { drawId: 'd1', candidates: ['A'], winners: ['A'], seedHash: 'h' },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
