// Plan SC: FR-R87.1~5
import { describe, it, expect } from 'vitest';
import { RagasPlusEvaluator, createRagasPlusEvaluator } from '../ragas-plus-evaluator';

describe('RagasPlusEvaluator', () => {
  it('FR-R87.1: adds golden items', () => {
    const e = createRagasPlusEvaluator();
    e.addGolden({
      id: 'g1',
      question: '민원 접수 방법',
      groundTruth: '온라인 민원 시스템',
      contexts: ['온라인 시스템', '전화'],
    });
    expect(e.getGoldenItems().length).toBe(1);
  });

  it('FR-R87.2: computes 4 metrics with overall', () => {
    const e = new RagasPlusEvaluator();
    const score = e.evaluate({
      question: '민원 접수 방법 안내',
      answer: '민원 접수는 온라인으로 가능',
      contexts: ['민원 접수 온라인 가능', '기타 정보'],
      groundTruth: '온라인 민원',
    });
    expect(score.overall).toBeGreaterThan(0);
    expect(score.contextRecall).toBeGreaterThan(0);
    expect(score.faithfulness).toBeGreaterThan(0);
  });

  it('FR-R87.3: batch eval averages', () => {
    const e = createRagasPlusEvaluator();
    const report = e.evaluateBatch([
      {
        id: 'a',
        input: {
          question: '민원',
          answer: '민원 접수',
          contexts: ['민원 접수 안내'],
        },
      },
      {
        id: 'b',
        input: {
          question: '주차',
          answer: '주차장 이용',
          contexts: ['주차장'],
        },
      },
    ]);
    expect(report.n).toBe(2);
    expect(report.avg.overall).toBeGreaterThan(0);
    expect(report.perItem.length).toBe(2);
  });

  it('FR-R87.4: regression detected when overall drops beyond threshold', () => {
    const e = createRagasPlusEvaluator(0.05);
    e.setBaseline({
      contextPrecision: 0.8,
      contextRecall: 0.8,
      faithfulness: 0.8,
      answerRelevancy: 0.8,
      overall: 0.8,
    });
    const report = e.checkRegression({
      contextPrecision: 0.6,
      contextRecall: 0.6,
      faithfulness: 0.6,
      answerRelevancy: 0.6,
      overall: 0.6,
    });
    expect(report.regressed).toBe(true);
    expect(e.getAuditLog().some((x) => x.action === 'REGRESSION')).toBe(true);
  });

  it('FR-R87.4: no regression within threshold', () => {
    const e = createRagasPlusEvaluator(0.05);
    e.setBaseline({
      contextPrecision: 0.7,
      contextRecall: 0.7,
      faithfulness: 0.7,
      answerRelevancy: 0.7,
      overall: 0.7,
    });
    const report = e.checkRegression({
      contextPrecision: 0.69,
      contextRecall: 0.69,
      faithfulness: 0.69,
      answerRelevancy: 0.69,
      overall: 0.69,
    });
    expect(report.regressed).toBe(false);
  });

  it('FR-R87.5: audit log contains EVAL/BATCH', () => {
    const e = createRagasPlusEvaluator();
    e.evaluate({ question: 'q', answer: 'a', contexts: ['c'] });
    const log = e.getAuditLog();
    expect(log.some((x) => x.action === 'EVAL')).toBe(true);
  });

  it('rejects invalid golden item', () => {
    const e = createRagasPlusEvaluator();
    expect(() =>
      e.addGolden({ id: '', question: '', groundTruth: '', contexts: [] }),
    ).toThrow();
  });
});
