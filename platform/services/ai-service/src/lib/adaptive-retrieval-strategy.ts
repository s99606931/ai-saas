// Adaptive Retrieval Strategy — FR-R52.1~R52.6
// Design Ref: SVC-AI-ADV-R52 DESIGN §2, §3, §4
// Plan SC: top-5 정확도 +25%, 평균 지연 -30%
// CSAP: D-12 시스템 개발 보안, D-08 인덱스 접근 통제

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type RetrievalStrategy = 'bm25' | 'dense' | 'hybrid' | 'multi-hop';

export interface QueryFeatures {
  length: number;
  hasInterrogative: boolean;
  hasComparison: boolean;
  hasReasoning: boolean;
  hasNumber: boolean;
  tokenCount: number;
}

export interface QueryClassification {
  strategy: RetrievalStrategy;
  confidence: number;
  features: QueryFeatures;
}

export interface RetrievalDoc {
  id: string;
  score: number;
  text: string;
}

export type RetrieverFn = (query: string, k: number) => Promise<RetrievalDoc[]>;

export interface RetrieverSet {
  bm25?: RetrieverFn;
  dense?: RetrieverFn;
  hybrid?: RetrieverFn;
  multiHop?: RetrieverFn;
}

export interface RetrievalRequest {
  query: string;
  k?: number;
  /** 강제 전략 (분류 무시) */
  forceStrategy?: RetrievalStrategy;
  dataGrade?: 'O' | 'C' | 'S';
}

export interface RetrievalResult {
  docs: RetrievalDoc[];
  strategy: RetrievalStrategy;
  classification: QueryClassification;
  fellBack: boolean;
}

export interface StrategyAuditEntry {
  timestamp: number;
  query: string;
  strategy: RetrievalStrategy;
  confidence: number;
  fellBack: boolean;
  resultCount: number;
}

export interface StrategyStats {
  bm25: number;
  dense: number;
  hybrid: number;
  multiHop: number;
  fallbacks: number;
  total: number;
}

// ── 한국어/영어 키워드 패턴 ──────────────────────────────────────────────────

const INTERROGATIVE_PATTERNS = [
  /\?$/,
  /^무엇/, /^어떻게/, /^왜/, /^언제/, /^어디/, /^누가/, /^몇/,
  /^what /i, /^how /i, /^why /i, /^when /i, /^where /i, /^who /i,
];

const COMPARISON_PATTERNS = [
  /비교/, /차이/, /대비/, /\bvs\b/i, /versus/i, /\b와\b/,
  /compare/i, /difference/i,
];

const REASONING_PATTERNS = [
  /왜.*어떻게/, /원인.*결과/, /때문에/, /이유.*결과/,
  /\bwhy.*because\b/i, /\bcause.*effect\b/i,
  /따라서/, /그러므로/, /하지만/,
];

const DEFAULT_K = 5;
const FALLBACK_CONFIDENCE = 0.5;

// ── AdaptiveRetrievalStrategy ────────────────────────────────────────────────

/**
 * 쿼리 복잡도에 따라 검색 전략을 자동 선택합니다.
 *
 * - 키워드/사실 → BM25
 * - 자연어 질문 → dense embedding
 * - 비교/복합 → hybrid (BM25 + dense)
 * - 추론/연쇄 → multi-hop
 *
 * 분류 신뢰도가 낮으면 hybrid로 폴백합니다.
 */
export class AdaptiveRetrievalStrategy {
  private readonly auditLog: StrategyAuditEntry[] = [];
  private readonly counters: StrategyStats = {
    bm25: 0,
    dense: 0,
    hybrid: 0,
    multiHop: 0,
    fallbacks: 0,
    total: 0,
  };

  constructor(private readonly retrievers: RetrieverSet) {}

  // ── FR-R52.1: 쿼리 복잡도 분류 ────────────────────────────────────────────

  /**
   * 쿼리의 특징을 추출하고 적합한 검색 전략을 결정합니다.
   */
  classifyQuery(query: string): QueryClassification {
    const features = this.extractFeatures(query);

    // 추론 패턴 → multi-hop
    if (features.hasReasoning) {
      return {
        strategy: 'multi-hop',
        confidence: 0.85,
        features,
      };
    }

    // 비교/복합 → hybrid
    if (features.hasComparison) {
      return {
        strategy: 'hybrid',
        confidence: 0.8,
        features,
      };
    }

    // 의문문 → dense
    if (features.hasInterrogative) {
      const conf = features.tokenCount > 5 ? 0.75 : 0.65;
      return {
        strategy: 'dense',
        confidence: conf,
        features,
      };
    }

    // 짧은 키워드 + 숫자/고유 → BM25
    if (features.tokenCount <= 4 || features.hasNumber) {
      return {
        strategy: 'bm25',
        confidence: features.hasNumber ? 0.8 : 0.7,
        features,
      };
    }

    // 기본: dense (낮은 신뢰도)
    return {
      strategy: 'dense',
      confidence: 0.45,
      features,
    };
  }

  // ── FR-R52.2: 전략 선택 ──────────────────────────────────────────────────

  /**
   * 분류 결과 + 사용 가능한 retriever를 고려하여 최종 전략을 선택합니다.
   */
  selectStrategy(classification: QueryClassification): {
    strategy: RetrievalStrategy;
    fellBack: boolean;
  } {
    let strategy = classification.strategy;
    let fellBack = false;

    // confidence 낮으면 hybrid 폴백
    if (classification.confidence < FALLBACK_CONFIDENCE) {
      strategy = 'hybrid';
      fellBack = true;
    }

    // 해당 retriever 미설정이면 우선순위 폴백
    if (!this.hasRetriever(strategy)) {
      const candidates: RetrievalStrategy[] = ['hybrid', 'dense', 'bm25', 'multi-hop'];
      const found = candidates.find((s) => this.hasRetriever(s));
      if (!found) {
        throw new Error('STRATEGY_NO_RETRIEVERS');
      }
      strategy = found;
      fellBack = true;
    }

    return { strategy, fellBack };
  }

  // ── FR-R52.3: 전략 실행 ──────────────────────────────────────────────────

  /**
   * 쿼리를 분류하고 적합한 retriever로 검색을 실행합니다.
   *
   * @throws STRATEGY_DATA_GRADE_BLOCKED — C/S등급
   * @throws STRATEGY_NO_RETRIEVERS — 사용 가능한 retriever 없음
   */
  async retrieve(req: RetrievalRequest): Promise<RetrievalResult> {
    this.assertDataGrade(req);
    const k = req.k ?? DEFAULT_K;

    const classification = this.classifyQuery(req.query);
    let strategy: RetrievalStrategy;
    let fellBack: boolean;

    if (req.forceStrategy) {
      strategy = req.forceStrategy;
      fellBack = false;
      if (!this.hasRetriever(strategy)) {
        throw new Error(`STRATEGY_NOT_AVAILABLE: ${strategy}`);
      }
    } else {
      const sel = this.selectStrategy(classification);
      strategy = sel.strategy;
      fellBack = sel.fellBack;
    }

    const retriever = this.getRetriever(strategy);
    const docs = await retriever(req.query, k);

    this.recordStats(strategy, fellBack);
    this.audit({
      timestamp: Date.now(),
      query: req.query,
      strategy,
      confidence: classification.confidence,
      fellBack,
      resultCount: docs.length,
    });

    return { docs, strategy, classification, fellBack };
  }

  // ── FR-R52.4: 폴백 (명시적 호출 가능) ─────────────────────────────────────

  /**
   * 강제 hybrid 폴백 검색
   */
  async fallback(query: string, k = DEFAULT_K): Promise<RetrievalResult> {
    return this.retrieve({ query, k, forceStrategy: 'hybrid' });
  }

  // ── FR-R52.5: 통계 ───────────────────────────────────────────────────────

  stats(): StrategyStats {
    return { ...this.counters };
  }

  // ── FR-R52.6: 감사 로그 ───────────────────────────────────────────────────

  audit(entry: StrategyAuditEntry): void {
    this.auditLog.push(entry);
  }

  getAuditLog(): readonly StrategyAuditEntry[] {
    return this.auditLog;
  }

  // ── 내부 ──────────────────────────────────────────────────────────────────

  private assertDataGrade(req: RetrievalRequest): void {
    const grade = req.dataGrade ?? 'O';
    if (grade === 'C' || grade === 'S') {
      throw new Error('STRATEGY_DATA_GRADE_BLOCKED');
    }
  }

  private extractFeatures(query: string): QueryFeatures {
    const trimmed = query.trim();
    const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
    return {
      length: trimmed.length,
      tokenCount: tokens.length,
      hasInterrogative: INTERROGATIVE_PATTERNS.some((p) => p.test(trimmed)),
      hasComparison: COMPARISON_PATTERNS.some((p) => p.test(trimmed)),
      hasReasoning: REASONING_PATTERNS.some((p) => p.test(trimmed)),
      hasNumber: /\d/.test(trimmed),
    };
  }

  private hasRetriever(s: RetrievalStrategy): boolean {
    if (s === 'bm25') {
      return !!this.retrievers.bm25;
    }
    if (s === 'dense') {
      return !!this.retrievers.dense;
    }
    if (s === 'hybrid') {
      return !!this.retrievers.hybrid;
    }
    return !!this.retrievers.multiHop;
  }

  private getRetriever(s: RetrievalStrategy): RetrieverFn {
    if (s === 'bm25' && this.retrievers.bm25) {
      return this.retrievers.bm25;
    }
    if (s === 'dense' && this.retrievers.dense) {
      return this.retrievers.dense;
    }
    if (s === 'hybrid' && this.retrievers.hybrid) {
      return this.retrievers.hybrid;
    }
    if (s === 'multi-hop' && this.retrievers.multiHop) {
      return this.retrievers.multiHop;
    }
    throw new Error(`STRATEGY_NOT_AVAILABLE: ${s}`);
  }

  private recordStats(s: RetrievalStrategy, fellBack: boolean): void {
    this.counters.total += 1;
    if (fellBack) {
      this.counters.fallbacks += 1;
    }
    if (s === 'bm25') {
      this.counters.bm25 += 1;
    } else if (s === 'dense') {
      this.counters.dense += 1;
    } else if (s === 'hybrid') {
      this.counters.hybrid += 1;
    } else {
      this.counters.multiHop += 1;
    }
  }
}
