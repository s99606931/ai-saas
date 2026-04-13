import { describe, it, expect, beforeEach } from 'vitest';
import { PublicDaycareQualityAI, type DaycareMetrics } from '../public-daycare-quality-ai';

const metrics = (id: string, over: Partial<DaycareMetrics> = {}): DaycareMetrics => ({
  centerId: id,
  name: `어린이집-${id}`,
  teacherRatio: 4,
  hygieneScore: 95,
  facilitySafety: 92,
  programRichness: 90,
  parentSatisfaction: 92,
  incidentCount: 0,
  ...over,
});

describe('PublicDaycareQualityAI', () => {
  let ai: PublicDaycareQualityAI;

  beforeEach(() => {
    ai = new PublicDaycareQualityAI();
  });

  it('어린이집 등록', () => {
    ai.registerCenter(metrics('c1'));
    expect(ai.listCenters().length).toBe(1);
  });

  it('우수 어린이집 A등급', () => {
    ai.registerCenter(metrics('c1'));
    const r = ai.evaluate('c1');
    expect(r.grade).toBe('A');
  });

  it('사고 발생 시 감점 및 권고', () => {
    ai.registerCenter(metrics('c2', { incidentCount: 2, facilitySafety: 65 }));
    const r = ai.evaluate('c2');
    expect(r.improvements.some(i => i.includes('사고'))).toBe(true);
  });

  it('품질 순위 정렬', () => {
    ai.registerCenter(metrics('a', { hygieneScore: 70, parentSatisfaction: 70 }));
    ai.registerCenter(metrics('b'));
    const ranked = ai.rankByQuality(2);
    expect(ranked[0]!.centerId).toBe('b');
  });

  it('잘못된 교사 비율 거부', () => {
    expect(() => ai.registerCenter(metrics('x', { teacherRatio: 0 }))).toThrow();
  });

  it('S등급 차단', () => {
    expect(() => ai.registerCenter(metrics('c1'), 'S')).toThrow('BLOCKED');
  });
});
