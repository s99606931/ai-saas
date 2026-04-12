// Test Ref: MTU-N464 §model-card
import { describe, it, expect } from 'vitest';
import { ModelCardBuilder, computeFairness } from '../src/index.js';

describe('computeFairness — FR-AT.4', () => {
  it('집단 간 정확도 격차 계산', () => {
    const f = computeFairness(
      { female: 0.85, male: 0.93 },
      { female: 0.4, male: 0.6 },
      0.05,
    );
    expect(f.groupDisparity.male).toBe(0); // 최대 정확도 집단은 0
    expect(f.groupDisparity.female).toBeCloseTo(0.08, 5);
    expect(f.flaggedGroups).toContain('female');
    expect(f.demographicParityDiff).toBeCloseTo(0.2, 5);
  });

  it('집단 1개 이하면 DPD undefined', () => {
    const f = computeFairness({ total: 0.9 }, { total: 0.5 });
    expect(f.demographicParityDiff).toBeUndefined();
  });

  it('모든 집단 동일 정확도면 플래그 없음', () => {
    const f = computeFairness({ a: 0.9, b: 0.9 }, { a: 0.5, b: 0.5 });
    expect(f.flaggedGroups).toEqual([]);
  });
});

describe('ModelCardBuilder — FR-AT.1/2/3/5', () => {
  it('카드 빌드 + Markdown 렌더링', () => {
    const builder = new ModelCardBuilder();
    const card = builder.build({
      metadata: {
        id: 'm1',
        name: '채용 분류기',
        version: '1.0.0',
        purpose: '서류 심사',
        developer: '공공 SaaS',
        trainedAt: '2026-03-01',
        license: 'internal',
      },
      trainingData: {
        sources: ['internal_hr'],
        sampleCount: 10000,
        distribution: { 'gender.female': 0.48, 'gender.male': 0.52 },
        collectionPeriod: '2024-01~2025-12',
        preprocessing: ['PII 마스킹', '불균형 SMOTE'],
      },
      performance: { accuracy: 0.91, precision: 0.88, recall: 0.85, f1: 0.865 },
      fairness: computeFairness(
        { female: 0.9, male: 0.92 },
        { female: 0.3, male: 0.32 },
      ),
      limitations: ['신입 대상만 학습'],
      ethicalConsiderations: ['성별 편향 모니터링 필요'],
    });
    const md = builder.renderMarkdown(card);
    expect(md).toContain('Model Card');
    expect(md).toContain('채용 분류기');
    expect(md).toContain('Sample count: 10000');
    expect(md).toContain('accuracy: 0.91');
    expect(md).toContain('성별 편향');
  });
});
