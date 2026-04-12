import { describe, it, expect, beforeEach } from 'vitest';
import {
  JudgeEngine,
  type JudgmentInput,
  type PairwiseResult,
} from '../llm-as-judge.js';

const goodResponse = JSON.stringify({
  accuracy: 5,
  relevance: 4,
  coherence: 5,
  safety: 5,
  rationale: '정확하고 공공 표준에 부합',
});

const badResponse = JSON.stringify({
  accuracy: 1,
  relevance: 2,
  coherence: 1,
  safety: 3,
  rationale: '환각 다수',
});

function makeJudge(fixed: string) {
  return async (_p: string, _m: string) => fixed;
}

function makeSequenceJudge(seq: string[]) {
  let i = 0;
  return async (_p: string, _m: string) => {
    const v = seq[i] ?? seq[seq.length - 1] ?? '{}';
    i += 1;
    return v;
  };
}

describe('JudgeEngine.evaluate (FR-R49.1)', () => {
  let engine: JudgeEngine;

  beforeEach(() => {
    engine = new JudgeEngine(makeJudge(goodResponse));
  });

  const baseInput: JudgmentInput = {
    query: '공공기관 정보보호 절차',
    response: 'CSAP 79개 통제 항목 준수',
    generatorModel: 'gpt-4-turbo',
  };

  it('4축 점수와 가중평균 계산', async () => {
    const score = await engine.evaluate(baseInput, 'claude-3-opus');
    expect(score.accuracy).toBe(5);
    expect(score.relevance).toBe(4);
    expect(score.coherence).toBe(5);
    expect(score.safety).toBe(5);
    // 5*0.35 + 4*0.30 + 5*0.20 + 5*0.15 = 1.75+1.2+1+0.75 = 4.7
    expect(score.overall).toBeCloseTo(4.7, 2);
  });

  it('judge 모델명 기록', async () => {
    const score = await engine.evaluate(baseInput, 'claude-3-opus');
    expect(score.judgeModel).toBe('claude-3-opus');
  });

  it('JSON 파싱 실패 시 예외', async () => {
    const broken = new JudgeEngine(makeJudge('not json'));
    await expect(broken.evaluate(baseInput, 'claude-3-opus')).rejects.toThrow(/JUDGE_PARSE_FAILED/);
  });

  it('점수 범위 0~5로 clamp', async () => {
    const overflow = new JudgeEngine(
      makeJudge(JSON.stringify({ accuracy: 99, relevance: -3, coherence: 5, safety: 5, rationale: '' })),
    );
    const score = await overflow.evaluate(baseInput, 'claude-3-opus');
    expect(score.accuracy).toBe(5);
    expect(score.relevance).toBe(0);
  });
});

describe('JudgeEngine.detectBias (FR-R49.5)', () => {
  const engine = new JudgeEngine(makeJudge(goodResponse));

  it('동일 모델 평가 시 JUDGE_SELF_BIAS 예외', async () => {
    await expect(
      engine.evaluate(
        { query: 'q', response: 'r', generatorModel: 'gpt-4' },
        'gpt-4',
      ),
    ).rejects.toThrow('JUDGE_SELF_BIAS');
  });

  it('같은 패밀리 감지 (gpt-4 vs gpt-4-turbo)', () => {
    const result = engine.detectBias('gpt-4', 'gpt-4-turbo');
    expect(result.sameFamily).toBe(true);
  });

  it('다른 패밀리 (gpt vs claude)', () => {
    const result = engine.detectBias('gpt-4', 'claude-3-opus');
    expect(result.sameFamily).toBe(false);
  });
});

describe('JudgeEngine N2SF 데이터 등급 차단', () => {
  const engine = new JudgeEngine(makeJudge(goodResponse));

  it('C등급 데이터 차단', async () => {
    await expect(
      engine.evaluate(
        { query: 'q', response: 'r', generatorModel: 'gpt-4', dataGrade: 'C' },
        'claude-3-opus',
      ),
    ).rejects.toThrow('JUDGE_DATA_GRADE_BLOCKED');
  });

  it('S등급 데이터 차단', async () => {
    await expect(
      engine.evaluate(
        { query: 'q', response: 'r', generatorModel: 'gpt-4', dataGrade: 'S' },
        'claude-3-opus',
      ),
    ).rejects.toThrow('JUDGE_DATA_GRADE_BLOCKED');
  });

  it('O등급 허용', async () => {
    const score = await engine.evaluate(
      { query: 'q', response: 'r', generatorModel: 'gpt-4', dataGrade: 'O' },
      'claude-3-opus',
    );
    expect(score.overall).toBeGreaterThan(0);
  });
});

describe('JudgeEngine.compare 페어와이즈 (FR-R49.2)', () => {
  it('일관된 결과는 final = primary', async () => {
    const calls: PairwiseResult[] = ['A_wins', 'B_wins'];
    let i = 0;
    const pairwise = async (): Promise<PairwiseResult> => {
      const r = calls[i] ?? 'tie';
      i += 1;
      return r;
    };
    const engine = new JudgeEngine(makeJudge(goodResponse), pairwise);
    const result = await engine.compare('q', 'A', 'B', 'gpt-4', 'claude-3-opus');
    // primary=A_wins, swappedRaw=B_wins → invert → A_wins → 일치
    expect(result.positionBiased).toBe(false);
    expect(result.final).toBe('A_wins');
  });

  it('위치 편향 발견 시 final = tie', async () => {
    const calls: PairwiseResult[] = ['A_wins', 'A_wins'];
    let i = 0;
    const pairwise = async (): Promise<PairwiseResult> => {
      const r = calls[i] ?? 'tie';
      i += 1;
      return r;
    };
    const engine = new JudgeEngine(makeJudge(goodResponse), pairwise);
    const result = await engine.compare('q', 'A', 'B', 'gpt-4', 'claude-3-opus');
    // primary=A_wins, swappedRaw=A_wins → invert → B_wins → 불일치
    expect(result.positionBiased).toBe(true);
    expect(result.final).toBe('tie');
  });

  it('pairwiseJudge 미설정 시 예외', async () => {
    const engine = new JudgeEngine(makeJudge(goodResponse));
    await expect(
      engine.compare('q', 'A', 'B', 'gpt-4', 'claude-3-opus'),
    ).rejects.toThrow('JUDGE_PAIRWISE_NOT_CONFIGURED');
  });
});

describe('JudgeEngine.ensemble 다중 judge (FR-R49.3)', () => {
  it('3개 judge median 채택', async () => {
    const seq = [
      JSON.stringify({ accuracy: 5, relevance: 5, coherence: 5, safety: 5, rationale: '' }),
      JSON.stringify({ accuracy: 4, relevance: 4, coherence: 4, safety: 4, rationale: '' }),
      JSON.stringify({ accuracy: 3, relevance: 3, coherence: 3, safety: 3, rationale: '' }),
    ];
    const engine = new JudgeEngine(makeSequenceJudge(seq));
    const result = await engine.ensemble(
      { query: 'q', response: 'r', generatorModel: 'gpt-4' },
      ['claude-3-opus', 'gemini-pro', 'llama-3'],
    );
    expect(result.judges).toHaveLength(3);
    expect(result.median.accuracy).toBe(4);
    expect(result.median.relevance).toBe(4);
  });

  it('judge 최소 2개 미만 시 예외', async () => {
    const engine = new JudgeEngine(makeJudge(goodResponse));
    await expect(
      engine.ensemble({ query: 'q', response: 'r', generatorModel: 'gpt-4' }, ['claude-3-opus']),
    ).rejects.toThrow('JUDGE_ENSEMBLE_MIN_TWO');
  });

  it('표준편차 0.5 초과 시 disagreement 플래그', async () => {
    const seq = [
      JSON.stringify({ accuracy: 5, relevance: 5, coherence: 5, safety: 5, rationale: '' }),
      JSON.stringify({ accuracy: 1, relevance: 1, coherence: 1, safety: 1, rationale: '' }),
      JSON.stringify({ accuracy: 5, relevance: 5, coherence: 5, safety: 5, rationale: '' }),
    ];
    const engine = new JudgeEngine(makeSequenceJudge(seq));
    const result = await engine.ensemble(
      { query: 'q', response: 'r', generatorModel: 'gpt-4' },
      ['claude-3-opus', 'gemini-pro', 'llama-3'],
    );
    expect(result.disagreement).toBe(true);
    expect(result.stdDev.accuracy).toBeGreaterThan(0.5);
  });

  it('일치된 점수는 disagreement = false', async () => {
    const seq = [
      JSON.stringify({ accuracy: 5, relevance: 5, coherence: 5, safety: 5, rationale: '' }),
      JSON.stringify({ accuracy: 5, relevance: 5, coherence: 5, safety: 5, rationale: '' }),
    ];
    const engine = new JudgeEngine(makeSequenceJudge(seq));
    const result = await engine.ensemble(
      { query: 'q', response: 'r', generatorModel: 'gpt-4' },
      ['claude-3-opus', 'gemini-pro'],
    );
    expect(result.disagreement).toBe(false);
  });
});

describe('JudgeEngine.audit 감사 로그 (FR-R49.4)', () => {
  it('evaluate 호출 시 감사 로그 기록', async () => {
    const engine = new JudgeEngine(makeJudge(goodResponse));
    await engine.evaluate(
      { query: 'q', response: 'r', generatorModel: 'gpt-4' },
      'claude-3-opus',
    );
    const log = engine.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.action).toBe('JUDGE_EVALUATE');
    expect(log[0]?.judgeModel).toBe('claude-3-opus');
  });

  it('ensemble 호출 시 evaluate + ensemble 모두 기록', async () => {
    const seq = [goodResponse, goodResponse];
    const engine = new JudgeEngine(makeSequenceJudge(seq));
    await engine.ensemble(
      { query: 'q', response: 'r', generatorModel: 'gpt-4' },
      ['claude-3-opus', 'gemini-pro'],
    );
    const log = engine.getAuditLog();
    // 2x evaluate + 1x ensemble = 3 entries
    expect(log.length).toBeGreaterThanOrEqual(3);
    expect(log.some((e) => e.action === 'JUDGE_ENSEMBLE')).toBe(true);
  });
});

describe('JudgeEngine.stats 통계 (FR-R49.6)', () => {
  it('빈 통계는 모두 0', () => {
    const engine = new JudgeEngine(makeJudge(goodResponse));
    const s = engine.stats();
    expect(s.count).toBe(0);
    expect(s.mean).toBe(0);
  });

  it('누적 점수 통계 산출', async () => {
    const seq = [
      JSON.stringify({ accuracy: 5, relevance: 5, coherence: 5, safety: 5, rationale: '' }),
      JSON.stringify({ accuracy: 3, relevance: 3, coherence: 3, safety: 3, rationale: '' }),
      JSON.stringify({ accuracy: 1, relevance: 1, coherence: 1, safety: 1, rationale: '' }),
    ];
    const engine = new JudgeEngine(makeSequenceJudge(seq));
    for (let i = 0; i < 3; i += 1) {
      await engine.evaluate({ query: 'q', response: 'r', generatorModel: 'gpt-4' }, 'claude-3-opus');
    }
    const s = engine.stats();
    expect(s.count).toBe(3);
    expect(s.min).toBeCloseTo(1, 2);
    expect(s.max).toBeCloseTo(5, 2);
    expect(s.mean).toBeCloseTo(3, 2);
  });

  it('resetStats 후 0', async () => {
    const engine = new JudgeEngine(makeJudge(goodResponse));
    await engine.evaluate({ query: 'q', response: 'r', generatorModel: 'gpt-4' }, 'claude-3-opus');
    engine.resetStats();
    expect(engine.stats().count).toBe(0);
  });
});

describe('JudgeEngine 통합 — 낮은 점수 응답', () => {
  it('나쁜 응답은 overall 낮음', async () => {
    const engine = new JudgeEngine(makeJudge(badResponse));
    const score = await engine.evaluate(
      { query: 'q', response: 'bad', generatorModel: 'gpt-4' },
      'claude-3-opus',
    );
    // 1*0.35 + 2*0.30 + 1*0.20 + 3*0.15 = 0.35+0.6+0.2+0.45 = 1.6
    expect(score.overall).toBeCloseTo(1.6, 2);
  });
});
