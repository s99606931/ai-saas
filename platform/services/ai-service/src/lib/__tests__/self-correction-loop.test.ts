import { describe, it, expect } from 'vitest';
import {
  SelfCorrectionLoop,
  type CritiqueResult,
} from '../self-correction-loop.js';

function buildLoop(opts: {
  initial: string;
  critiques: CritiqueResult[];
  reviseTransform?: (resp: string) => string;
}) {
  let critIdx = 0;
  const generate = async () => opts.initial;
  const critique = async (_q: string, _r: string): Promise<CritiqueResult> => {
    const c = opts.critiques[critIdx] ?? { issues: [], severity: 'none' as const };
    critIdx += 1;
    return c;
  };
  const revise = async (_q: string, r: string, _c: CritiqueResult) => {
    return opts.reviseTransform ? opts.reviseTransform(r) : `${r} (revised)`;
  };
  return new SelfCorrectionLoop(generate, critique, revise);
}

describe('SelfCorrectionLoop.run (FR-R53.4)', () => {
  it('첫 비평에서 수렴 시 반복 1회', async () => {
    const loop = buildLoop({
      initial: 'good answer',
      critiques: [{ issues: [], severity: 'none' }],
    });
    const r = await loop.run({ query: 'q' });
    expect(r.iterations).toBe(1);
    expect(r.converged).toBe(true);
    expect(r.finalResponse).toBe('good answer');
  });

  it('이슈 발견 시 수정 적용', async () => {
    const loop = buildLoop({
      initial: 'wrong',
      critiques: [
        { issues: ['fact error'], severity: 'high' },
        { issues: [], severity: 'none' },
      ],
    });
    const r = await loop.run({ query: 'q' });
    expect(r.iterations).toBe(2);
    expect(r.converged).toBe(true);
    expect(r.finalResponse).toBe('wrong (revised)');
  });

  it('maxIter 도달 시 종료 (수렴 실패)', async () => {
    const loop = buildLoop({
      initial: 'always wrong',
      critiques: [
        { issues: ['e1'], severity: 'high' },
        { issues: ['e2'], severity: 'high' },
        { issues: ['e3'], severity: 'high' },
      ],
    });
    const r = await loop.run({ query: 'q', maxIter: 3 });
    expect(r.iterations).toBe(3);
    expect(r.converged).toBe(false);
  });

  it('maxIter 0 이하는 예외', async () => {
    const loop = buildLoop({ initial: 'x', critiques: [] });
    await expect(loop.run({ query: 'q', maxIter: 0 })).rejects.toThrow('CORRECT_INVALID_MAX_ITER');
  });

  it('history에 매 반복 기록', async () => {
    const loop = buildLoop({
      initial: 'a',
      critiques: [
        { issues: ['e1'], severity: 'medium' },
        { issues: ['e2'], severity: 'low' },
        { issues: [], severity: 'none' },
      ],
    });
    const r = await loop.run({ query: 'q' });
    expect(r.history).toHaveLength(3);
    expect(r.history[0]?.critique.issues).toEqual(['e1']);
    expect(r.history[1]?.critique.issues).toEqual(['e2']);
    expect(r.history[2]?.critique.issues).toEqual([]);
  });
});

describe('SelfCorrectionLoop.hasConverged (FR-R53.3)', () => {
  const loop = buildLoop({ initial: '', critiques: [] });

  it('issues 0개 → 수렴', () => {
    expect(loop.hasConverged({ issues: [], severity: 'high' })).toBe(true);
  });

  it("severity 'none' → 수렴", () => {
    expect(loop.hasConverged({ issues: ['x'], severity: 'none' })).toBe(true);
  });

  it("issues 있고 severity 'high' → 미수렴", () => {
    expect(loop.hasConverged({ issues: ['x'], severity: 'high' })).toBe(false);
  });
});

describe('SelfCorrectionLoop N2SF', () => {
  const loop = buildLoop({ initial: 'a', critiques: [{ issues: [], severity: 'none' }] });

  it('C등급 차단', async () => {
    await expect(loop.run({ query: 'q', dataGrade: 'C' })).rejects.toThrow('CORRECT_DATA_GRADE_BLOCKED');
  });

  it('S등급 차단', async () => {
    await expect(loop.run({ query: 'q', dataGrade: 'S' })).rejects.toThrow('CORRECT_DATA_GRADE_BLOCKED');
  });

  it('O등급 허용', async () => {
    const r = await loop.run({ query: 'q', dataGrade: 'O' });
    expect(r.converged).toBe(true);
  });
});

describe('SelfCorrectionLoop.runCritique / runRevise (FR-R53.1, R53.2)', () => {
  it('직접 critique 호출', async () => {
    const loop = buildLoop({
      initial: 'r',
      critiques: [{ issues: ['issue'], severity: 'medium' }],
    });
    const c = await loop.runCritique('q', 'r');
    expect(c.issues).toEqual(['issue']);
    expect(c.severity).toBe('medium');
  });

  it('직접 revise 호출', async () => {
    const loop = buildLoop({
      initial: 'r',
      critiques: [],
      reviseTransform: (s) => `[fixed]${s}`,
    });
    const out = await loop.runRevise('q', 'orig', { issues: ['e'], severity: 'high' });
    expect(out).toBe('[fixed]orig');
  });
});

describe('SelfCorrectionLoop.extractIssueTrend (FR-R53.5)', () => {
  it('이슈 개수 추세 추출', async () => {
    const loop = buildLoop({
      initial: 'a',
      critiques: [
        { issues: ['e1', 'e2', 'e3'], severity: 'high' },
        { issues: ['e1'], severity: 'medium' },
        { issues: [], severity: 'none' },
      ],
    });
    const r = await loop.run({ query: 'q' });
    const trend = SelfCorrectionLoop.extractIssueTrend(r);
    expect(trend).toEqual([3, 1, 0]);
  });
});

describe('SelfCorrectionLoop.audit (FR-R53.6)', () => {
  it('run 완료 시 CORRECT_RUN 기록', async () => {
    const loop = buildLoop({
      initial: 'a',
      critiques: [{ issues: [], severity: 'none' }],
    });
    await loop.run({ query: 'q' });
    const log = loop.getAuditLog();
    expect(log.some((e) => e.action === 'CORRECT_RUN')).toBe(true);
  });

  it('runCritique / runRevise 직접 호출 시 각각 액션 기록', async () => {
    const loop = buildLoop({
      initial: 'a',
      critiques: [{ issues: ['e'], severity: 'high' }],
    });
    await loop.runCritique('q', 'r');
    await loop.runRevise('q', 'r', { issues: ['e'], severity: 'high' });
    const log = loop.getAuditLog();
    expect(log.some((e) => e.action === 'CORRECT_CRITIQUE')).toBe(true);
    expect(log.some((e) => e.action === 'CORRECT_REVISE')).toBe(true);
  });
});
