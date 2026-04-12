// MTU-N342 여론 집계 테스트
import { describe, it, expect } from 'vitest';
import { PublicOpinionAggregatorService } from '../public-opinion-aggregator.js';

describe('MTU-N342 PublicOpinionAggregator', () => {
  const svc = new PublicOpinionAggregatorService('tenant-n342');

  it('FR-N342.1: 여론 수집', () => {
    const e = svc.collect('twitter', '정책이 좋습니다', '정책', 'positive');
    expect(e).toBeDefined();
  });

  it('FR-N342.2: 주제 클러스터', () => {
    const entries = [
      svc.collect('news', '경제 정책 효과', '경제', 'positive'),
      svc.collect('news', '경제 어렵다', '경제', 'negative'),
    ];
    const clusters = svc.cluster(entries);
    expect(Array.isArray(clusters)).toBe(true);
  });

  it('FR-N342.3: 리포트 생성', () => {
    const entries = [svc.collect('twitter', '좋음', '복지', 'positive')];
    const report = svc.report(entries);
    expect(report).toBeDefined();
  });

  it('FR-N342.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
