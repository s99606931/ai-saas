/**
 * 알고리즘 투명성 + 설명가능성 테스트
 * Plan SC: FR-AT.1~5, FR-XAI.1~5
 */

import {
  ModelCardBuilder,
  FairnessAnalyzer,
  TransparencyReportRenderer,
  ExplanationBuilder,
} from '../src/transparency-report';

describe('ModelCardBuilder', () => {
  it('필수 필드 누락 시 build 오류', () => {
    const b = new ModelCardBuilder();
    expect(() => b.build()).toThrow(/필수 필드/);
  });

  it('체이닝 + build 성공', () => {
    const card = new ModelCardBuilder()
      .setBasic('m1', '1.0.0', 'classification', '민원 분류 모델')
      .setTrainingData({
        sources: ['민원 DB'],
        sampleCount: 10000,
        periodStart: '2025-01-01',
        periodEnd: '2025-12-31',
      })
      .addMetric('accuracy', 0.92)
      .addFairness('female', 1.05)
      .addLimitation('소수 외국어 미지원')
      .build();
    expect(card.modelId).toBe('m1');
    expect(card.performance.length).toBe(1);
    expect(card.fairness.length).toBe(1);
    expect(card.limitations.length).toBe(1);
  });

  it('기본값 적용 (version 1.0.0, 빈 배열)', () => {
    const card = new ModelCardBuilder()
      .setBasic('m1', '', '', '')
      .setTrainingData({
        sources: [],
        sampleCount: 0,
        periodStart: '',
        periodEnd: '',
      })
      .build();
    expect(card.performance).toEqual([]);
    expect(card.fairness).toEqual([]);
  });
});

describe('FairnessAnalyzer', () => {
  const f = new FairnessAnalyzer();

  it('disparateImpact: 0인 경우 0', () => {
    expect(f.disparateImpact(0.5, 0)).toBe(0);
  });

  it('isFair: 0.8~1.25 범위', () => {
    expect(f.isFair(1.0)).toBe(true);
    expect(f.isFair(0.79)).toBe(false);
    expect(f.isFair(1.26)).toBe(false);
    expect(f.isFair(0.8)).toBe(true);
    expect(f.isFair(1.25)).toBe(true);
  });

  it('disparateImpact 비율 계산', () => {
    expect(f.disparateImpact(0.4, 0.5)).toBeCloseTo(0.8);
  });
});

describe('TransparencyReportRenderer', () => {
  it('Markdown 출력 포함 항목', () => {
    const card = new ModelCardBuilder()
      .setBasic('m1', '1.0.0', 'classification', '설명')
      .setTrainingData({
        sources: ['DB'],
        sampleCount: 1000,
        periodStart: '2025',
        periodEnd: '2026',
      })
      .addMetric('acc', 0.9)
      .addFairness('group1', 1.0)
      .addLimitation('limit1')
      .build();
    const md = new TransparencyReportRenderer().toMarkdown(card);
    expect(md).toContain('# 알고리즘 투명성 보고서');
    expect(md).toContain('m1');
    expect(md).toContain('1.0.0');
    expect(md).toContain('학습 데이터');
    expect(md).toContain('한계');
  });
});

describe('ExplanationBuilder', () => {
  const b = new ExplanationBuilder();

  it('top 5 features 정렬 (절대값)', () => {
    const r = b.build({
      decisionId: 'd1',
      subjectId: 's1',
      outcome: '거절',
      features: [
        { feature: 'income', importance: 0.5 },
        { feature: 'age', importance: -0.7 },
        { feature: 'history', importance: 0.1 },
      ],
      appealUrl: 'https://x',
    });
    expect(r.topFeatures[0]?.feature).toBe('age');
    expect(r.naturalLanguage).toContain('age');
    expect(r.naturalLanguage).toContain('이의');
  });

  it('5개 초과 시 상위 5개만', () => {
    const features = Array.from({ length: 10 }, (_, i) => ({
      feature: `f${i}`,
      importance: i * 0.1,
    }));
    const r = b.build({
      decisionId: 'd1',
      subjectId: 's1',
      outcome: 'ok',
      features,
      appealUrl: 'x',
    });
    expect(r.topFeatures.length).toBe(5);
  });
});
