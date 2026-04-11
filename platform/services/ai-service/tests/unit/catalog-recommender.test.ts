import { describe, it, expect, beforeEach } from 'vitest';
import { indexService, recommend, contentBasedRecommend, collaborativeRecommend, registerProfile, getCatalogAuditLog, type CatalogService, type UserProfile } from '../../src/lib/catalog-recommender';

const SERVICES: CatalogService[] = [
  { id: 's1', name: '전자결재', description: '공공기관 전자결재', category: '행정', tags: ['결재', '문서', '행정'], features: ['결재선', '위임'], targetOrganizationType: ['시청', '구청'], monthlyPrice: 100000 },
  { id: 's2', name: '민원관리', description: '온라인 민원 관리', category: '민원', tags: ['민원', '접수', '처리'], features: ['접수', '추적'], targetOrganizationType: ['시청'], monthlyPrice: 80000 },
  { id: 's3', name: '인사관리', description: '인사 급여 관리', category: '인사', tags: ['인사', '급여', '행정'], features: ['급여', '휴가'], targetOrganizationType: ['시청', '구청'], monthlyPrice: 120000 },
  { id: 's4', name: '재정관리', description: '예산 회계 관리', category: '재정', tags: ['예산', '회계', '재정'], features: ['예산편성'], targetOrganizationType: ['시청'], monthlyPrice: 150000 },
];

const PROFILES: UserProfile[] = [
  { userId: 'u1', organizationId: 'org1', organizationType: '시청', adoptedServices: ['s1', 's2'], searchHistory: [], clickHistory: [] },
  { userId: 'u2', organizationId: 'org2', organizationType: '시청', adoptedServices: ['s1', 's3', 's4'], searchHistory: [], clickHistory: [] },
  { userId: 'u3', organizationId: 'org3', organizationType: '구청', adoptedServices: ['s1'], searchHistory: [], clickHistory: [] },
];

describe('서비스 카탈로그 추천', () => {
  beforeEach(() => { SERVICES.forEach(indexService); PROFILES.forEach(registerProfile); });

  it('콘텐츠 기반 추천을 생성해야 한다', () => {
    const recs = contentBasedRecommend(PROFILES[0], 5);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].method).toBe('content_based');
  });

  it('협업 필터링 추천을 생성해야 한다', () => {
    const recs = collaborativeRecommend(PROFILES[0], PROFILES, 5);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].method).toBe('collaborative');
  });

  it('하이브리드 추천을 생성해야 한다', () => {
    const result = recommend('u1', PROFILES, 'test-user');
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('이미 채택한 서비스는 추천하지 않아야 한다', () => {
    const result = recommend('u1', PROFILES, 'test-user');
    const adoptedIds = new Set(PROFILES[0].adoptedServices);
    for (const rec of result.recommendations) {
      expect(adoptedIds.has(rec.serviceId)).toBe(false);
    }
  });

  it('감사 로그가 기록되어야 한다', () => {
    recommend('u1', PROFILES, 'test-user');
    expect(getCatalogAuditLog().length).toBeGreaterThan(0);
  });
});
