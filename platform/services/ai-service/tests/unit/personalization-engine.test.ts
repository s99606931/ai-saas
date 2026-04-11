// SVC-AI-ADV-R33 단위 테스트: AI 개인화 엔진
// Design Ref: SVC-AI-ADV-R33 DESIGN §1, §3, §6
// Plan SC: FR-ADV33.1, FR-ADV33.3, FR-ADV33.6
// CSAP: D-08 추천 데이터 접근 통제

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  PersonalizationEngine,
  getPersonalizationEngine,
  resetPersonalizationEngine,
} from '../../src/lib/personalization-engine.js';
import { UserProfileManager } from '../../src/lib/user-profile-ai.js';
import type { ContentItem, Experiment } from '../../src/lib/personalization-engine.js';

function createContent(overrides?: Partial<ContentItem>): ContentItem {
  return {
    id: `content-${Math.random().toString(36).slice(2, 8)}`,
    title: '테스트 콘텐츠',
    category: '보안',
    tags: ['CSAP', 'D-12'],
    popularity: 80,
    createdAt: new Date().toISOString(),
    tenantId: 'tenant-1',
    ...overrides,
  };
}

// -- 콘텐츠 인덱스 관리 ---------------------------------------------------------

describe('PersonalizationEngine 콘텐츠 인덱스', () => {
  let engine: PersonalizationEngine;
  let profileManager: UserProfileManager;

  beforeEach(() => {
    profileManager = new UserProfileManager();
    engine = new PersonalizationEngine({
      profileManager,
    });
  });

  it('콘텐츠를 등록한다', () => {
    const content = createContent({ id: 'c1' });
    engine.indexContent(content);
    // 추천에서 해당 콘텐츠가 나와야 함
    const results = engine.recommend('tenant-1', 'user-new');
    expect(results.some((r) => r.contentId === 'c1')).toBe(true);
  });

  it('콘텐츠를 배치 등록한다', () => {
    engine.indexContents([
      createContent({ id: 'c1' }),
      createContent({ id: 'c2' }),
    ]);
    const results = engine.recommend('tenant-1', 'user-new');
    expect(results.length).toBe(2);
  });

  it('콘텐츠를 제거한다', () => {
    engine.indexContent(createContent({ id: 'c1' }));
    engine.removeContent('c1');
    const results = engine.recommend('tenant-1', 'user-new');
    expect(results.some((r) => r.contentId === 'c1')).toBe(false);
  });
});

// -- 추천 생성 -- Design §3 ---------------------------------------------------

describe('PersonalizationEngine 추천 (FR-ADV33.3)', () => {
  let engine: PersonalizationEngine;
  let profileManager: UserProfileManager;

  beforeEach(() => {
    profileManager = new UserProfileManager();
    engine = new PersonalizationEngine({
      profileManager,
      defaultRecommendation: { limit: 5, diversityWeight: 0.3, popularityWeight: 0.2, recencyWeight: 0.2 },
    });

    // 테스트용 콘텐츠 등록
    for (let i = 0; i < 10; i++) {
      engine.indexContent(createContent({
        id: `c-${i}`,
        category: i < 5 ? '보안' : '인프라',
        popularity: 50 + i * 5,
        tenantId: 'tenant-1',
      }));
    }
  });

  it('콘텐츠가 없는 테넌트는 빈 결과', () => {
    const results = engine.recommend('tenant-other', 'user-1');
    expect(results).toHaveLength(0);
  });

  it('limit 수만큼 추천한다', () => {
    const results = engine.recommend('tenant-1', 'user-1');
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('overrideConfig으로 limit를 변경한다', () => {
    const results = engine.recommend('tenant-1', 'user-1', { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('추천 결과에 score와 reason을 포함한다', () => {
    const results = engine.recommend('tenant-1', 'user-1');
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.reason).toBeTruthy();
      expect(r.algorithm).toBe('mmr_hybrid');
    }
  });

  it('이미 본 콘텐츠를 제외한다', () => {
    // user-1이 c-0을 봤다고 기록
    profileManager.processEvent({
      userId: 'user-1',
      tenantId: 'tenant-1',
      contentId: 'c-0',
      eventType: 'view',
      timestamp: new Date().toISOString(),
    });

    const results = engine.recommend('tenant-1', 'user-1');
    expect(results.some((r) => r.contentId === 'c-0')).toBe(false);
  });

  it('테넌트 격리: 다른 테넌트 콘텐츠를 추천하지 않는다', () => {
    engine.indexContent(createContent({ id: 'other-c', tenantId: 'tenant-other' }));
    const results = engine.recommend('tenant-1', 'user-1');
    expect(results.some((r) => r.contentId === 'other-c')).toBe(false);
  });
});

// -- 이벤트 수집 (위임) -- Design §1 -------------------------------------------

describe('PersonalizationEngine 이벤트 수집', () => {
  it('trackEvent로 프로파일 매니저에 이벤트를 위임한다', () => {
    const profileManager = new UserProfileManager();
    const engine = new PersonalizationEngine({ profileManager });

    engine.trackEvent({
      userId: 'user-1', tenantId: 'tenant-1', contentId: 'c1',
      eventType: 'click', timestamp: new Date().toISOString(), category: '보안',
    });

    const profile = profileManager.getProfile('tenant-1', 'user-1');
    expect(profile).toBeDefined();
    expect(profile!.totalEvents).toBe(1);
  });
});

// -- A/B 테스트 -- Design §6 --------------------------------------------------

describe('PersonalizationEngine A/B 테스트 (FR-ADV33.6)', () => {
  let engine: PersonalizationEngine;
  let profileManager: UserProfileManager;

  beforeEach(() => {
    profileManager = new UserProfileManager();
    engine = new PersonalizationEngine({
      profileManager,
      defaultRecommendation: { limit: 10, diversityWeight: 0.3, popularityWeight: 0.2, recencyWeight: 0.2 },
    });
    for (let i = 0; i < 5; i++) {
      engine.indexContent(createContent({ id: `c-${i}`, tenantId: 'tenant-1' }));
    }
  });

  it('실험을 등록한다', () => {
    const experiment: Experiment = {
      id: 'exp-1',
      name: '추천 limit 테스트',
      variants: [
        { id: 'v-a', name: 'control', config: { limit: 5 }, weight: 1, impressions: 0, clicks: 0 },
        { id: 'v-b', name: 'treatment', config: { limit: 3 }, weight: 1, impressions: 0, clicks: 0 },
      ],
      startDate: new Date().toISOString(),
      active: true,
    };
    engine.createExperiment(experiment);
    const results = engine.getExperimentResults('exp-1');
    expect(results).toBeDefined();
    expect(results!).toHaveLength(2);
  });

  it('클릭을 기록한다', () => {
    const experiment: Experiment = {
      id: 'exp-2',
      name: 'test',
      variants: [
        { id: 'v-a', name: 'A', config: {}, weight: 1, impressions: 0, clicks: 0 },
      ],
      startDate: new Date().toISOString(),
      active: true,
    };
    engine.createExperiment(experiment);
    engine.recordExperimentClick('exp-2', 'user-1');
    const results = engine.getExperimentResults('exp-2')!;
    expect(results[0]!.clicks).toBe(1);
  });

  it('존재하지 않는 실험은 결과 없음', () => {
    expect(engine.getExperimentResults('nonexistent')).toBeUndefined();
  });

  it('비활성 실험은 추천에 영향을 주지 않는다', () => {
    const experiment: Experiment = {
      id: 'exp-3',
      name: 'inactive',
      variants: [
        { id: 'v-a', name: 'A', config: { limit: 1 }, weight: 1, impressions: 0, clicks: 0 },
      ],
      startDate: new Date().toISOString(),
      active: false,
    };
    engine.createExperiment(experiment);
    const results = engine.recommend('tenant-1', 'user-1');
    // 비활성이므로 기본 limit(10) 적용
    expect(results.length).toBeGreaterThan(1);
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('PersonalizationEngine 팩토리', () => {
  afterEach(() => {
    resetPersonalizationEngine();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const e1 = getPersonalizationEngine();
    const e2 = getPersonalizationEngine();
    expect(e1).toBe(e2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const e1 = getPersonalizationEngine();
    resetPersonalizationEngine();
    const e2 = getPersonalizationEngine();
    expect(e1).not.toBe(e2);
  });
});
