// 의미 기반 라우팅 — FR-ADV23.1~23.6
// Design Ref: SVC-AI-ADV-R23 DESIGN §1~§5
// Plan SC: SC-1 (의도 라우팅), SC-2 (규칙 관리), SC-3 (유사도), SC-4 (폴백)
// CSAP: D-08 라우팅 정책 접근 통제, D-06 라우팅 결정 감사
// N2SF: N-05 O등급 데이터만 라우팅

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 라우팅 경로 정의 — Design §1 */
export interface SemanticRoute {
  id: string;
  name: string;
  description: string;
  /** 학습 예문 (의도 대표 발화) */
  utterances: string[];
  /** 예문 임베딩 캐시 */
  embeddings: number[][];
  /** 처리 핸들러 식별자 */
  handler: string;
  /** 우선순위 (높을수록 우선) */
  priority: number;
  /** 활성 여부 */
  enabled: boolean;
  /** 키워드 패턴 (폴백용) */
  keywords: string[];
}

/** 라우팅 결과 */
export interface RoutingResult {
  route: SemanticRoute;
  confidence: number;
  method: 'semantic' | 'keyword' | 'default';
  latencyMs: number;
}

/** 라우팅 메트릭 — Design §5 */
export interface RouteMetrics {
  routeId: string;
  totalHits: number;
  avgConfidence: number;
  avgLatencyMs: number;
  fallbackRate: number;
}

// ── 유사도 계산 ────────────────────────────────────────────────────────────

/** 코사인 유사도 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Semantic Router — Design §1~§4 ────────────────────────────────────────

/** 시맨틱 라우터 */
export class SemanticRouter {
  private readonly routes: Map<string, SemanticRoute> = new Map();
  private defaultRoute: SemanticRoute | undefined;
  private readonly metrics: Map<string, { hits: number; totalConf: number; totalLatency: number; fallbacks: number }> = new Map();
  private readonly similarityThreshold: number;

  constructor(threshold = 0.75) {
    this.similarityThreshold = threshold;
  }

  /** 경로 등록 — Design §2 */
  addRoute(route: SemanticRoute): void {
    this.routes.set(route.id, route);
    this.metrics.set(route.id, { hits: 0, totalConf: 0, totalLatency: 0, fallbacks: 0 });
  }

  /** 경로 삭제 */
  removeRoute(routeId: string): boolean {
    this.metrics.delete(routeId);
    return this.routes.delete(routeId);
  }

  /** 기본 경로 설정 */
  setDefault(route: SemanticRoute): void {
    this.defaultRoute = route;
  }

  /** 경로 활성화/비활성화 */
  setEnabled(routeId: string, enabled: boolean): boolean {
    const route = this.routes.get(routeId);
    if (!route) return false;
    route.enabled = enabled;
    return true;
  }

  /**
   * 라우팅 실행 — Design §3, §4
   *
   * 1. 임베딩 유사도 매칭 (queryEmbedding 제공 시)
   * 2. 키워드 매칭 (폴백)
   * 3. 기본 경로 (최종 폴백)
   */
  route(query: string, queryEmbedding?: number[]): RoutingResult | undefined {
    const startTime = Date.now();

    // 1. 임베딩 기반 시맨틱 매칭
    if (queryEmbedding && queryEmbedding.length > 0) {
      let bestRoute: SemanticRoute | undefined;
      let bestScore = 0;

      for (const route of this.routes.values()) {
        if (!route.enabled) continue;

        for (const embedding of route.embeddings) {
          const score = cosineSimilarity(queryEmbedding, embedding);
          if (score > bestScore) {
            bestScore = score;
            bestRoute = route;
          }
        }
      }

      if (bestRoute && bestScore >= this.similarityThreshold) {
        const latency = Date.now() - startTime;
        this.recordMetric(bestRoute.id, bestScore, latency, false);
        return {
          route: bestRoute,
          confidence: bestScore,
          method: 'semantic',
          latencyMs: latency,
        };
      }
    }

    // 2. 키워드 폴백 매칭
    const queryLower = query.toLowerCase();
    let keywordRoute: SemanticRoute | undefined;
    let keywordScore = 0;

    for (const route of this.routes.values()) {
      if (!route.enabled) continue;

      let matchCount = 0;
      for (const keyword of route.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }

      if (route.keywords.length > 0) {
        const score = matchCount / route.keywords.length;
        if (score > keywordScore) {
          keywordScore = score;
          keywordRoute = route;
        }
      }
    }

    if (keywordRoute && keywordScore > 0.3) {
      const latency = Date.now() - startTime;
      this.recordMetric(keywordRoute.id, keywordScore, latency, true);
      return {
        route: keywordRoute,
        confidence: keywordScore,
        method: 'keyword',
        latencyMs: latency,
      };
    }

    // 3. 기본 경로
    if (this.defaultRoute) {
      const latency = Date.now() - startTime;
      return {
        route: this.defaultRoute,
        confidence: 0.3,
        method: 'default',
        latencyMs: latency,
      };
    }

    return undefined;
  }

  /** 메트릭 기록 */
  private recordMetric(routeId: string, confidence: number, latency: number, isFallback: boolean): void {
    const m = this.metrics.get(routeId);
    if (m) {
      m.hits++;
      m.totalConf += confidence;
      m.totalLatency += latency;
      if (isFallback) m.fallbacks++;
    }
  }

  /** 경로별 메트릭 조회 — Design §5 */
  getMetrics(): RouteMetrics[] {
    const results: RouteMetrics[] = [];
    for (const [routeId, m] of this.metrics) {
      results.push({
        routeId,
        totalHits: m.hits,
        avgConfidence: m.hits > 0 ? m.totalConf / m.hits : 0,
        avgLatencyMs: m.hits > 0 ? m.totalLatency / m.hits : 0,
        fallbackRate: m.hits > 0 ? m.fallbacks / m.hits : 0,
      });
    }
    return results;
  }

  /** 경로 수 */
  get size(): number {
    return this.routes.size;
  }

  /** 경로 목록 */
  list(): SemanticRoute[] {
    return [...this.routes.values()];
  }
}
