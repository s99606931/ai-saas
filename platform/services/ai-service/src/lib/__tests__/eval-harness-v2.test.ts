import { describe, it, expect } from 'vitest';
import {
  EvalHarnessV2,
  type EvalDataset,
  type EvalSample,
} from '../eval-harness-v2.js';

function sample(id: string, partial: Partial<EvalSample> = {}): EvalSample {
  return {
    id,
    question: '정보공개 청구 처리 기간',
    groundTruth: '정보공개 청구는 법에 따라 10일 이내 처리된다',
    contexts: ['정보공개 청구는 법에 따라 10일 이내 처리한다.'],
    answer: '정보공개 청구는 10일 이내 처리됩니다.',
    grade: 'O',
    ...partial,
  };
}

function dataset(id: string, samples: EvalSample[]): EvalDataset {
  return { id, name: `dataset-${id}`, samples };
}

describe('addDataset 등급 검증 (FR-R68.1)', () => {
  it('O 등급 허용', () => {
    const h = new EvalHarnessV2();
    h.addDataset(dataset('d1', [sample('s1')]));
    expect(h.getDatasetCount()).toBe(1);
  });
  it('C 등급 차단', () => {
    const h = new EvalHarnessV2();
    expect(() =>
      h.addDataset(dataset('d1', [sample('s1', { grade: 'C' })])),
    ).toThrow('EVAL_GRADE_BLOCKED');
  });
  it('S 등급 차단', () => {
    const h = new EvalHarnessV2();
    expect(() =>
      h.addDataset(dataset('d1', [sample('s1', { grade: 'S' })])),
    ).toThrow('EVAL_GRADE_BLOCKED');
  });
});

describe('scoreSample 지표 6종 (FR-R68.2)', () => {
  it('완벽 답변의 지표 모두 높음', () => {
    const h = new EvalHarnessV2();
    const s = sample('s1');
    const scores = h.scoreSample(s);
    expect(scores.faithfulness).toBeGreaterThan(0);
    expect(scores.answerRelevance).toBeGreaterThan(0);
    expect(scores.contextPrecision).toBeGreaterThan(0);
    expect(scores.contextRecall).toBeGreaterThan(0);
    expect(scores.similarity).toBeGreaterThan(0);
    expect(scores.groundedness).toBeGreaterThan(0);
  });
  it('무관한 답변의 similarity 낮음', () => {
    const h = new EvalHarnessV2();
    const s = sample('s1', { answer: '완전히 다른 이야기' });
    const scores = h.scoreSample(s);
    expect(scores.similarity).toBeLessThan(0.5);
  });
  it('빈 context → contextPrecision 0', () => {
    const h = new EvalHarnessV2();
    const s = sample('s1', { contexts: [] });
    const scores = h.scoreSample(s);
    expect(scores.contextPrecision).toBe(0);
  });
});

describe('run 벤치 실행 (FR-R68.3)', () => {
  it('샘플 평균 집계', () => {
    const h = new EvalHarnessV2();
    h.addDataset(dataset('d1', [sample('s1'), sample('s2')]));
    const report = h.run('d1');
    expect(report.sampleCount).toBe(2);
    expect(report.perSample.length).toBe(2);
    expect(report.aggregate.similarity).toBeGreaterThan(0);
  });
  it('존재하지 않는 데이터셋 에러', () => {
    const h = new EvalHarnessV2();
    expect(() => h.run('nope')).toThrow('EVAL_DATASET_NOT_FOUND');
  });
});

describe('baseline 회귀 판정 (FR-R68.4)', () => {
  it('baseline 대비 동일 → 회귀 없음', () => {
    const h = new EvalHarnessV2();
    h.addDataset(dataset('d1', [sample('s1')]));
    const first = h.run('d1');
    h.setBaseline('d1', first.aggregate);
    const second = h.run('d1');
    expect(second.regression?.regressed).toBe(false);
  });
  it('baseline 대비 급감 → 회귀', () => {
    const h = new EvalHarnessV2();
    h.addDataset(dataset('d1', [sample('s1')]));
    h.setBaseline('d1', {
      faithfulness: 1,
      answerRelevance: 1,
      contextPrecision: 1,
      contextRecall: 1,
      similarity: 1,
      groundedness: 1,
    });
    const report = h.run('d1');
    expect(report.regression?.regressed).toBe(true);
    expect(report.regression?.regressedMetrics.length).toBeGreaterThan(0);
  });
});

describe('감사 로그 (FR-R68.5, CSAP D-06)', () => {
  it('DATASET_REGISTER + BENCH_RUN 기록', () => {
    const h = new EvalHarnessV2();
    h.addDataset(dataset('d1', [sample('s1')]));
    h.run('d1');
    const actions = h.getAuditLog().map((e) => e.action);
    expect(actions).toContain('DATASET_REGISTER');
    expect(actions).toContain('BENCH_RUN');
  });
  it('GRADE_BLOCK 기록', () => {
    const h = new EvalHarnessV2();
    try {
      h.addDataset(dataset('d1', [sample('s1', { grade: 'C' })]));
    } catch {
      /* noop */
    }
    expect(h.getAuditLog().some((e) => e.action === 'GRADE_BLOCK')).toBe(true);
  });
  it('BASELINE_SET 기록', () => {
    const h = new EvalHarnessV2();
    h.addDataset(dataset('d1', [sample('s1')]));
    h.setBaseline('d1', h.scoreSample(sample('s1')));
    expect(h.getAuditLog().some((e) => e.action === 'BASELINE_SET')).toBe(true);
  });
});
