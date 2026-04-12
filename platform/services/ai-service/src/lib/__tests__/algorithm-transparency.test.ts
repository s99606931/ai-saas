import { describe, it, expect, beforeEach } from 'vitest';
import { AlgorithmTransparency, type ModelCard } from '../algorithm-transparency';

describe('AlgorithmTransparency', () => {
  let svc: AlgorithmTransparency;
  const card: ModelCard = {
    modelId: 'm1',
    name: '민원 분류기',
    version: '1.0',
    purpose: '민원 자동 분류',
    trainDatasets: [{ name: 'gov-complaints', source: '정부', size: 10000 }],
    metrics: { accuracy: 0.92, f1: 0.89 },
    knownLimitations: ['2020년 이전 데이터 없음'],
  };

  beforeEach(() => {
    svc = new AlgorithmTransparency();
    svc.registerCard(card);
  });

  it('FR-AT.1 모델 카드', () => {
    expect(svc.getCard('m1')?.name).toBe('민원 분류기');
  });

  it('FR-AT.2 데이터 분포', () => {
    const records = [{ region: '서울' }, { region: '서울' }, { region: '부산' }];
    const d = svc.computeDistribution(records, 'region');
    expect(d.distribution['서울']).toBe(2);
  });

  it('FR-AT.3 성능 메트릭', () => {
    const m = svc.summarizeMetrics('m1');
    expect(m?.accuracy).toBe(0.92);
  });

  it('FR-AT.4 공정성', () => {
    const r = svc.evaluateFairness({ male: 0.9, female: 0.6 });
    expect(r.some((x) => x.warning)).toBe(true);
  });

  it('FR-AT.5 MD 리포트', () => {
    const md = svc.generateMarkdown('m1');
    expect(md).toContain('모델 카드');
    expect(md).toContain('민원 분류기');
  });
});
