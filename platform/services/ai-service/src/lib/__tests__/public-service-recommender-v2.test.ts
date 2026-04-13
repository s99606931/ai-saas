import { describe, it, expect, beforeEach } from 'vitest';
import { PublicServiceRecommenderV2 } from '../public-service-recommender-v2';

describe('PublicServiceRecommenderV2', () => {
  let recommender: PublicServiceRecommenderV2;

  beforeEach(() => {
    recommender = new PublicServiceRecommenderV2();
  });

  it('서비스를 등록한다', () => {
    recommender.registerService('svc-1', '민원24', '민원', ['민원', '정부']);
    expect(recommender.getAuditLog().some(l => l.action === 'REGISTER_SERVICE')).toBe(true);
  });

  it('사용 이력을 기록한다', () => {
    recommender.registerService('svc-1', '민원24', '민원', []);
    recommender.recordUsage('user-a', 'svc-1');
    expect(recommender.getAuditLog().some(l => l.action === 'RECORD_USAGE')).toBe(true);
  });

  it('사용 이력 없으면 인기 서비스를 추천한다', () => {
    recommender.registerService('svc-1', '민원24', '민원', []);
    recommender.registerService('svc-2', '복지로', '복지', []);
    recommender.recordUsage('user-b', 'svc-1');
    recommender.recordUsage('user-b', 'svc-1');
    const recs = recommender.recommend('new-user', 3);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.reason).toBe('popular');
  });

  it('협업 필터링으로 추천한다', () => {
    recommender.registerService('svc-1', 'A', 'cat', []);
    recommender.registerService('svc-2', 'B', 'cat', []);
    recommender.registerService('svc-3', 'C', 'cat', []);
    // user-a와 user-b는 svc-1을 공유, user-b는 svc-2도 사용
    recommender.recordUsage('user-a', 'svc-1');
    recommender.recordUsage('user-b', 'svc-1');
    recommender.recordUsage('user-b', 'svc-2');
    const recs = recommender.recommend('user-a', 5);
    expect(recs.some(r => r.serviceId === 'svc-2')).toBe(true);
  });

  it('인기 서비스 목록을 반환한다', () => {
    recommender.registerService('svc-1', 'A', 'cat', []);
    recommender.registerService('svc-2', 'B', 'cat', []);
    recommender.recordUsage('user-a', 'svc-1');
    recommender.recordUsage('user-b', 'svc-1');
    recommender.recordUsage('user-c', 'svc-2');
    const popular = recommender.getPopularServices(2);
    expect(popular[0]!.id).toBe('svc-1');
  });

  it('C등급 사용 기록을 차단한다', () => {
    recommender.registerService('svc-1', 'A', 'cat', []);
    expect(() => recommender.recordUsage('user-a', 'svc-1', 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 서비스 기록 시 오류를 던진다', () => {
    expect(() => recommender.recordUsage('user-a', 'unknown-svc')).toThrow('서비스 미등록');
  });
});
