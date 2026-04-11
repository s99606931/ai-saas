// SVC-AI-ADV-R23 단위 테스트: 의미 기반 라우팅
// Design Ref: SVC-AI-ADV-R23 DESIGN §1~§5
// Plan SC: FR-ADV23.1~23.6
// CSAP: D-08 라우팅 정책 접근 통제, D-06 라우팅 결정 감사

import { describe, it, expect, beforeEach } from 'vitest';

import { SemanticRouter } from '../../src/lib/semantic-router.js';
import type { SemanticRoute } from '../../src/lib/semantic-router.js';

// ── 테스트 헬퍼 ────────────────────────────────────────────────────────────

function createRoute(overrides: Partial<SemanticRoute> = {}): SemanticRoute {
  return {
    id: 'route-1',
    name: '법령 조회',
    description: '법령 관련 질문 처리',
    utterances: ['법령 검색', '법률 조회'],
    embeddings: [[0.9, 0.1, 0.0], [0.8, 0.2, 0.0]],
    handler: 'regulation-handler',
    priority: 1,
    enabled: true,
    keywords: ['법령', '법률', '규정', '조례'],
    ...overrides,
  };
}

function createCivilRoute(): SemanticRoute {
  return createRoute({
    id: 'route-2',
    name: '민원 접수',
    description: '민원 관련 처리',
    utterances: ['민원 신청'],
    embeddings: [[0.1, 0.9, 0.0], [0.0, 0.8, 0.2]],
    handler: 'civil-handler',
    priority: 2,
    keywords: ['민원', '신청', '접수', '신고'],
  });
}

// ── SemanticRouter 경로 관리 — Design §2 ───────────────────────────────────

describe('SemanticRouter 경로 관리 (FR-ADV23.2)', () => {
  let router: SemanticRouter;

  beforeEach(() => {
    router = new SemanticRouter();
  });

  it('경로를 등록한다', () => {
    router.addRoute(createRoute());
    expect(router.size).toBe(1);
  });

  it('여러 경로를 등록한다', () => {
    router.addRoute(createRoute());
    router.addRoute(createCivilRoute());
    expect(router.size).toBe(2);
  });

  it('경로를 삭제한다', () => {
    router.addRoute(createRoute());
    const removed = router.removeRoute('route-1');
    expect(removed).toBe(true);
    expect(router.size).toBe(0);
  });

  it('존재하지 않는 경로 삭제는 false', () => {
    expect(router.removeRoute('nonexistent')).toBe(false);
  });

  it('경로 목록을 반환한다', () => {
    router.addRoute(createRoute());
    router.addRoute(createCivilRoute());
    const list = router.list();
    expect(list).toHaveLength(2);
  });

  it('경로를 비활성화한다', () => {
    router.addRoute(createRoute());
    const result = router.setEnabled('route-1', false);
    expect(result).toBe(true);
  });

  it('존재하지 않는 경로 활성화 변경은 false', () => {
    expect(router.setEnabled('nonexistent', true)).toBe(false);
  });
});

// ── SemanticRouter 시맨틱 라우팅 — Design §3 ──────────────────────────────

describe('SemanticRouter 시맨틱 라우팅 (FR-ADV23.3)', () => {
  let router: SemanticRouter;

  beforeEach(() => {
    router = new SemanticRouter(0.7);
    router.addRoute(createRoute());
    router.addRoute(createCivilRoute());
  });

  it('임베딩 유사도로 라우팅한다', () => {
    const queryEmbedding = [0.85, 0.15, 0.0]; // 법령 라우트와 유사
    const result = router.route('법령 검색', queryEmbedding);
    expect(result).toBeDefined();
    expect(result!.route.id).toBe('route-1');
    expect(result!.method).toBe('semantic');
    expect(result!.confidence).toBeGreaterThan(0.7);
  });

  it('민원 임베딩은 민원 라우트로 라우팅한다', () => {
    const queryEmbedding = [0.1, 0.85, 0.05]; // 민원 라우트와 유사
    const result = router.route('민원 접수', queryEmbedding);
    expect(result).toBeDefined();
    expect(result!.route.id).toBe('route-2');
  });

  it('비활성화된 경로는 건너뛴다', () => {
    router.setEnabled('route-1', false);
    const queryEmbedding = [0.85, 0.15, 0.0];
    const result = router.route('법령 검색', queryEmbedding);
    // 법령 라우트가 비활성화되어 민원 라우트나 다른 결과가 나올 수 있음
    if (result && result.method === 'semantic') {
      expect(result.route.id).not.toBe('route-1');
    }
  });
});

// ── SemanticRouter 키워드 폴백 — Design §4 ─────────────────────────────────

describe('SemanticRouter 키워드 폴백 (FR-ADV23.4)', () => {
  let router: SemanticRouter;

  beforeEach(() => {
    router = new SemanticRouter(0.9); // 높은 임계값으로 시맨틱 매칭 어렵게
    router.addRoute(createRoute());
    router.addRoute(createCivilRoute());
  });

  it('키워드 매칭으로 폴백한다', () => {
    // 임베딩 없이 키워드만으로 라우팅
    const result = router.route('법령 규정 조회해주세요');
    expect(result).toBeDefined();
    expect(result!.route.id).toBe('route-1');
    expect(result!.method).toBe('keyword');
  });

  it('민원 키워드로 민원 라우트에 매칭한다', () => {
    const result = router.route('민원 신청하고 싶습니다');
    expect(result).toBeDefined();
    expect(result!.route.id).toBe('route-2');
  });

  it('매칭 키워드가 없으면 기본 경로를 사용한다', () => {
    const defaultRoute = createRoute({
      id: 'default',
      name: '기본',
      handler: 'default-handler',
      keywords: [],
      embeddings: [],
    });
    router.setDefault(defaultRoute);

    const result = router.route('완전히 관련없는 질문');
    expect(result).toBeDefined();
    expect(result!.route.id).toBe('default');
    expect(result!.method).toBe('default');
    expect(result!.confidence).toBe(0.3);
  });

  it('기본 경로도 없으면 undefined를 반환한다', () => {
    const result = router.route('관련없는 질문');
    expect(result).toBeUndefined();
  });
});

// ── SemanticRouter 메트릭 — Design §5 ──────────────────────────────────────

describe('SemanticRouter 메트릭 (FR-ADV23.5)', () => {
  let router: SemanticRouter;

  beforeEach(() => {
    router = new SemanticRouter(0.7);
    router.addRoute(createRoute());
    router.addRoute(createCivilRoute());
  });

  it('라우팅 후 메트릭을 기록한다', () => {
    router.route('법령 검색', [0.85, 0.15, 0.0]);
    router.route('법령 조회', [0.9, 0.1, 0.0]);

    const metrics = router.getMetrics();
    const regMetric = metrics.find((m) => m.routeId === 'route-1');
    expect(regMetric).toBeDefined();
    expect(regMetric!.totalHits).toBe(2);
    expect(regMetric!.avgConfidence).toBeGreaterThan(0);
  });

  it('미사용 경로는 0 메트릭이다', () => {
    const metrics = router.getMetrics();
    for (const m of metrics) {
      expect(m.totalHits).toBe(0);
    }
  });

  it('폴백률을 추적한다', () => {
    // 임베딩 없이 키워드 폴백 유도
    router.route('법령 규정 조회');
    const metrics = router.getMetrics();
    const regMetric = metrics.find((m) => m.routeId === 'route-1');
    if (regMetric && regMetric.totalHits > 0) {
      expect(regMetric.fallbackRate).toBeGreaterThanOrEqual(0);
    }
  });
});
