// AI 비용 최적화기 — FR-ADV8.4, FR-ADV8.6
// Design Ref: SVC-AI-ADV-R8 DESIGN §2, §4
// Plan SC: SC-2 (동적 모델 라우팅), SC-4 (비용 메트릭)
// CSAP: D-12 시스템 개발 보안

// ── 복잡도 등급 ──────────────────────────────────────────────────────────────

/** 쿼리 복잡도 등급 — Design §2.1 */
export type ComplexityLevel = 'simple' | 'standard' | 'expert';

/** 모델 티어 매핑 */
export interface ModelTier {
  level: ComplexityLevel;
  modelId: string;
  costMultiplier: number;
}

/** 복잡도 분류 결과 */
export interface ClassificationResult {
  level: ComplexityLevel;
  confidence: number;
  reason: string;
  recommendedModel: string;
}

// ── 비용 메트릭 ──────────────────────────────────────────────────────────────

/** 모델별 비용 메트릭 */
export interface ModelCostMetric {
  modelId: string;
  callCount: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  averageLatencyMs: number;
}

/** 전체 비용 메트릭 요약 */
export interface CostMetricsSummary {
  period: string;
  totalCalls: number;
  totalTokens: number;
  totalEstimatedCostUSD: number;
  savingsFromCache: number;
  savingsFromRouting: number;
  modelBreakdown: ModelCostMetric[];
  routingDistribution: Record<ComplexityLevel, number>;
}

// ── 설정 ─────────────────────────────────────────────────────────────────────

/** 비용 최적화 설정 */
export interface CostOptimizerConfig {
  /** 모델 티어 정의 */
  tiers: ModelTier[];
  /** 모델별 토큰당 비용 (USD / 1K 토큰) */
  pricing: Record<string, { input: number; output: number }>;
}

/** 기본 설정 — 온프레미스 LM Studio 기준 비용 비율 */
const DEFAULT_CONFIG: CostOptimizerConfig = {
  tiers: [
    { level: 'simple', modelId: 'haiku', costMultiplier: 1 },
    { level: 'standard', modelId: 'sonnet', costMultiplier: 3 },
    { level: 'expert', modelId: 'opus', costMultiplier: 15 },
  ],
  pricing: {
    haiku: { input: 0.00025, output: 0.00125 },
    sonnet: { input: 0.003, output: 0.015 },
    opus: { input: 0.015, output: 0.075 },
    // 온프레미스 LM Studio — 인프라 비용만 (전력, GPU)
    lmstudio: { input: 0.0001, output: 0.0005 },
  },
};

// ── 복잡도 분류 패턴 — Design §2.2 ──────────────────────────────────────────

/** 단순 질문 패턴 (FAQ, 절차 안내) */
const SIMPLE_PATTERNS = [
  /방법|절차|어떻게|안내|문의|연락처|주소|위치|시간/,
  /^[^.?!]{0,50}[?]$/, // 50자 이하 단순 질문
  /발급|신청|등록|접수|조회/,
  /영업시간|운영시간|휴무일|정기휴일/,
];

/** 전문가 수준 패턴 (법률 해석, 정책 분석) */
const EXPERT_PATTERNS = [
  /법률\s*해석|판례\s*분석|법적\s*검토/,
  /정책\s*분석|제도\s*비교|규제\s*영향/,
  /위헌|위법|소송|재판|헌법재판소/,
  /조문\s*해석|법리|판시|대법원/,
  /CSAP\s*감리|보안\s*감사|취약점\s*분석/,
  /아키텍처\s*설계|시스템\s*통합|마이그레이션/,
];

/** 시스템 프롬프트 복잡도 키워드 */
const EXPERT_SYSTEM_KEYWORDS = [
  '법률 전문가', '변호사', '법률 자문', '정책 분석가',
  '보안 전문가', '감리원', '아키텍트',
  '심층 분석', '종합 검토', '다각적 분석',
];

// ── 비용 최적화기 클래스 ─────────────────────────────────────────────────────

/**
 * AI 비용 최적화기
 *
 * LLM 호출 비용을 최소화하면서 응답 품질을 유지합니다.
 *
 * 핵심 기능:
 * 1. 복잡도 기반 동적 모델 라우팅 (simple→Haiku, standard→Sonnet, expert→Opus)
 * 2. 비용 메트릭 수집 및 분석
 * 3. 캐시 절감액 추적
 */
export class CostOptimizer {
  private readonly config: CostOptimizerConfig;

  // 메트릭 저장소
  private readonly metrics: Map<string, ModelCostMetric> = new Map();
  private routingCounts: Record<ComplexityLevel, number> = { simple: 0, standard: 0, expert: 0 };
  private cacheSavingsTokens = 0;
  private routingSavingsUSD = 0;

  constructor(config?: Partial<CostOptimizerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (config?.tiers) this.config.tiers = config.tiers;
    if (config?.pricing) this.config.pricing = { ...DEFAULT_CONFIG.pricing, ...config.pricing };
  }

  /**
   * 쿼리 복잡도를 분류하고 최적 모델을 추천합니다 — FR-ADV8.4
   *
   * @param query - 사용자 쿼리
   * @param systemPrompt - 시스템 프롬프트 (선택)
   * @param messageCount - 대화 턴 수
   * @returns 분류 결과 + 추천 모델
   */
  classifyComplexity(query: string, systemPrompt?: string, messageCount?: number): ClassificationResult {
    let score = 0; // -10(simple) ~ +10(expert)
    const reasons: string[] = [];

    // 1. 패턴 기반 분류
    for (const pattern of SIMPLE_PATTERNS) {
      if (pattern.test(query)) {
        score -= 3;
        reasons.push('단순 질문 패턴 감지');
        break;
      }
    }

    for (const pattern of EXPERT_PATTERNS) {
      if (pattern.test(query)) {
        score += 4;
        reasons.push('전문가 수준 패턴 감지');
        break;
      }
    }

    // 2. 쿼리 길이 기반
    const queryLength = query.length;
    if (queryLength < 30) {
      score -= 2;
      reasons.push('짧은 쿼리');
    } else if (queryLength > 200) {
      score += 2;
      reasons.push('긴 쿼리 (복잡한 질문)');
    } else if (queryLength > 500) {
      score += 3;
      reasons.push('매우 긴 쿼리');
    }

    // 3. 대화 턴 수 기반
    const turns = messageCount ?? 1;
    if (turns > 5) {
      score += 2;
      reasons.push(`다중 턴 대화 (${turns}턴)`);
    }

    // 4. 시스템 프롬프트 분석
    if (systemPrompt) {
      for (const keyword of EXPERT_SYSTEM_KEYWORDS) {
        if (systemPrompt.includes(keyword)) {
          score += 3;
          reasons.push(`전문가 시스템 프롬프트: "${keyword}"`);
          break;
        }
      }
    }

    // 점수 → 복잡도 등급
    let level: ComplexityLevel;
    let confidence: number;

    if (score <= -2) {
      level = 'simple';
      confidence = Math.min(0.95, 0.7 + Math.abs(score) * 0.05);
    } else if (score >= 3) {
      level = 'expert';
      confidence = Math.min(0.95, 0.6 + score * 0.05);
    } else {
      level = 'standard';
      confidence = 0.6 + Math.abs(score) * 0.03;
    }

    // 모델 선택
    const tier = this.config.tiers.find((t) => t.level === level);
    const recommendedModel = tier?.modelId ?? 'sonnet';

    // 라우팅 통계 기록
    this.routingCounts[level]++;

    return {
      level,
      confidence: Math.round(confidence * 100) / 100,
      reason: reasons.join('; ') || '기본 분류',
      recommendedModel,
    };
  }

  /**
   * LLM 호출 비용을 기록합니다 — FR-ADV8.6
   *
   * @param modelId - 사용된 모델 ID
   * @param promptTokens - 프롬프트 토큰 수
   * @param completionTokens - 생성 토큰 수
   * @param latencyMs - 응답 시간 (ms)
   */
  recordUsage(modelId: string, promptTokens: number, completionTokens: number, latencyMs: number): void {
    const existing = this.metrics.get(modelId) ?? {
      modelId,
      callCount: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      estimatedCostUSD: 0,
      averageLatencyMs: 0,
    };

    existing.callCount++;
    existing.totalPromptTokens += promptTokens;
    existing.totalCompletionTokens += completionTokens;
    existing.totalTokens += promptTokens + completionTokens;

    // 비용 계산
    const pricing = this.config.pricing[modelId] ?? this.config.pricing['lmstudio']!;
    const cost = (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output;
    existing.estimatedCostUSD += cost;

    // 이동 평균 레이턴시
    existing.averageLatencyMs =
      (existing.averageLatencyMs * (existing.callCount - 1) + latencyMs) / existing.callCount;

    this.metrics.set(modelId, existing);
  }

  /**
   * 캐시 히트로 절감된 비용을 기록합니다
   */
  recordCacheSaving(estimatedTokens: number): void {
    this.cacheSavingsTokens += estimatedTokens;
  }

  /**
   * 라우팅으로 절감된 비용을 기록합니다
   * (Opus 대신 Haiku/Sonnet을 사용한 경우의 차액)
   */
  recordRoutingSaving(actualCostUSD: number, wouldHaveCostUSD: number): void {
    this.routingSavingsUSD += Math.max(0, wouldHaveCostUSD - actualCostUSD);
  }

  /**
   * 비용 메트릭 요약을 반환합니다 — FR-ADV8.6
   */
  getMetricsSummary(period?: string): CostMetricsSummary {
    const modelBreakdown: ModelCostMetric[] = Array.from(this.metrics.values());
    const totalCalls = modelBreakdown.reduce((sum, m) => sum + m.callCount, 0);
    const totalTokens = modelBreakdown.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalEstimatedCostUSD = modelBreakdown.reduce((sum, m) => sum + m.estimatedCostUSD, 0);

    // 캐시 절감액 (기본 Sonnet 가격 기준 추정)
    const sonnetPricing = this.config.pricing['sonnet'] ?? { input: 0.003, output: 0.015 };
    const savingsFromCache = (this.cacheSavingsTokens / 1000) * sonnetPricing.output;

    return {
      period: period ?? new Date().toISOString().slice(0, 10),
      totalCalls,
      totalTokens,
      totalEstimatedCostUSD: Math.round(totalEstimatedCostUSD * 10000) / 10000,
      savingsFromCache: Math.round(savingsFromCache * 10000) / 10000,
      savingsFromRouting: Math.round(this.routingSavingsUSD * 10000) / 10000,
      modelBreakdown,
      routingDistribution: { ...this.routingCounts },
    };
  }

  /** 메트릭 초기화 */
  resetMetrics(): void {
    this.metrics.clear();
    this.routingCounts = { simple: 0, standard: 0, expert: 0 };
    this.cacheSavingsTokens = 0;
    this.routingSavingsUSD = 0;
  }
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

/**
 * 비용 최적화기 인스턴스 생성
 */
export function createCostOptimizer(config?: Partial<CostOptimizerConfig>): CostOptimizer {
  return new CostOptimizer(config);
}
