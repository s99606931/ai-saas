import { describe, it, expect, beforeEach } from 'vitest';
import { PublicDataOpennessOptimizer } from '../public-data-openness-optimizer';

describe('PublicDataOpennessOptimizer', () => {
  let optimizer: PublicDataOpennessOptimizer;
  const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();

  beforeEach(() => {
    optimizer = new PublicDataOpennessOptimizer();
  });

  it('데이터셋을 등록한다', () => {
    optimizer.registerDataset('ds-1', '공공 주차장', [], recentDate, 5000);
    expect(optimizer.getAuditLog().some(l => l.action === 'REGISTER_DATASET')).toBe(true);
  });

  it('최신 데이터셋은 높은 freshness 점수를 받는다', () => {
    optimizer.registerDataset('ds-1', '공공 주차장', [], recentDate, 5000);
    const score = optimizer.evaluateQuality('ds-1');
    expect(score.freshness).toBe(100);
  });

  it('오래된 데이터셋은 낮은 freshness 점수를 받는다', () => {
    optimizer.registerDataset('ds-2', '구형 데이터', [], oldDate, 5000);
    const score = optimizer.evaluateQuality('ds-2');
    expect(score.freshness).toBeLessThanOrEqual(10);
  });

  it('필수 필드 완전성을 계산한다', () => {
    optimizer.registerDataset('ds-3', '인구통계', [
      { name: 'region', required: true, value: '서울' },
      { name: 'count', required: true, value: '' },
    ], recentDate, 1000);
    const score = optimizer.evaluateQuality('ds-3');
    expect(score.completeness).toBe(50);
  });

  it('개방 등급 A를 반환한다 (고품질 데이터)', () => {
    optimizer.registerDataset('ds-4', '우수 데이터', [
      { name: 'id', required: true, value: '1' },
    ], recentDate, 10000);
    const grade = optimizer.classifyOpenness('ds-4');
    expect(['A', 'B']).toContain(grade);
  });

  it('개방 등급 F를 반환한다 (저품질 데이터)', () => {
    optimizer.registerDataset('ds-5', '불량 데이터', [
      { name: 'id', required: true, value: '' },
    ], oldDate, 5);
    const grade = optimizer.classifyOpenness('ds-5');
    expect(grade).toBe('F');
  });

  it('개선 권고를 반환한다', () => {
    optimizer.registerDataset('ds-6', '구형 소량 데이터', [
      { name: 'id', required: true, value: '' },
    ], oldDate, 10);
    const recs = optimizer.getMetadataRecommendations('ds-6');
    expect(recs.length).toBeGreaterThan(0);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    expect(() => optimizer.registerDataset('ds', '테스트', [], recentDate, 100, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 데이터셋 품질 평가 시 오류를 던진다', () => {
    expect(() => optimizer.evaluateQuality('unknown')).toThrow('데이터셋 미등록');
  });
});
