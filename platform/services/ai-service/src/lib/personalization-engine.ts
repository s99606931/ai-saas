// AI 개인화 엔진 -- FR-ADV33.1, FR-ADV33.3, FR-ADV33.6
// Design Ref: SVC-AI-ADV-R33 DESIGN §1, §3, §6
// Plan SC: SC-1 (추천 정확도), SC-2 (테넌트 격리)
// CSAP: D-08 추천 데이터 접근 통제

import {
  UserProfileManager,
  getUserProfileManager,
  hashUserId,
  type UserEvent,
  type UserProfile,
} from './user-profile-ai';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 콘텐츠 아이템 */
export interface ContentItem {
  id: string;
  title: string;
  category: string;
  tags: string[];
  embedding?: number[];
  popularity: number;
  createdAt: string;
  tenantId: string;
}

/** 추천 결과 */
export interface RecommendationResult {
  contentId: string;
  score: number;
  reason: string;
  algorithm: string;
}

/** 추천 설정 */
export interface RecommendationConfig {
  /** 추천 개수 */
  limit: number;
  /** 다양성 가중치 (0~1, 높을수록 다양) */
  diversityWeight: number;
  /** 인기도 가중치 (0~1) */
  popularityWeight: number;
  /** 최근성 가중치 (0~1) */
  recencyWeight: number;
}

/** A/B 테스트 실험 -- Design §6 */
export interface Experiment {
  id: string;
  name: string;
  variants: ExperimentVariant[];
  startDate: string;
  endDate?: string;
  active: boolean;
}

/** 실험 변형 */
export interface ExperimentVariant {
  id: string;
  name: string;
  config: Partial<RecommendationConfig>;
  weight: number;
  impressions: number;
  clicks: number;
}

/** 개인화 엔진 설정 */
export interface PersonalizationEngineConfig {
  defaultRecommendation: RecommendationConfig;
  profileManager?: UserProfileManager;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_RECOMMENDATION: RecommendationConfig = {
  limit: 10,
  diversityWeight: 0.3,
  popularityWeight: 0.2,
  recencyWeight: 0.2,
};

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'personalization-engine',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

// -- 코사인 유사도 ───────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// -- PersonalizationEngine 메인 클래스 ────────────────────────────────────────

/** AI 개인화 엔진 -- Design §3 */
export class PersonalizationEngine {
  private readonly profileManager: UserProfileManager;
  private readonly defaultConfig: RecommendationConfig;
  private contentIndex: Map<string, ContentItem> = new Map();
  private experiments: Map<string, Experiment> = new Map();

  constructor(config?: Partial<PersonalizationEngineConfig>) {
    this.profileManager = config?.profileManager ?? getUserProfileManager();
    this.defaultConfig = {
      ...DEFAULT_RECOMMENDATION,
      ...config?.defaultRecommendation,
    };
  }

  // -- 콘텐츠 인덱스 관리 ────────────────────────────────────────────────

  /** 콘텐츠 등록 */
  indexContent(item: ContentItem): void {
    this.contentIndex.set(item.id, item);
  }

  /** 콘텐츠 배치 등록 */
  indexContents(items: ContentItem[]): void {
    for (const item of items) {
      this.contentIndex.set(item.id, item);
    }
  }

  /** 콘텐츠 제거 */
  removeContent(contentId: string): void {
    this.contentIndex.delete(contentId);
  }

  // -- 이벤트 수집 (위임) -- Design §1 ───────────────────────────────────

  /** 행동 이벤트 수집 */
  trackEvent(event: UserEvent): void {
    this.profileManager.processEvent(event);
  }

  // -- 추천 생성 ─────────────────────────────────────────────────────────

  /** 개인화 추천 생성 -- Design §3 */
  recommend(
    tenantId: string,
    userId: string,
    overrideConfig?: Partial<RecommendationConfig>,
  ): RecommendationResult[] {
    const profile = this.profileManager.getOrCreateProfile(tenantId, userId);

    // A/B 테스트 실험 설정 적용
    const experimentConfig = this.getExperimentConfig(userId);
    const config: RecommendationConfig = {
      ...this.defaultConfig,
      ...experimentConfig,
      ...overrideConfig,
    };

    // 테넌트 콘텐츠 필터
    const tenantContents = Array.from(this.contentIndex.values()).filter(
      (c) => c.tenantId === tenantId,
    );

    // 이미 본 콘텐츠 제외
    const seenIds = new Set(profile.recentItems.map((r) => r.contentId));
    const candidates = tenantContents.filter((c) => !seenIds.has(c.id));

    if (candidates.length === 0) return [];

    // 점수 계산
    const scored = candidates.map((content) => ({
      content,
      score: this.calculateScore(content, profile, config),
    }));

    // MMR 다양성 보장 -- Design §3
    const results = this.applyMMR(scored, config);

    auditLog('recommendation_generated', {
      tenantId,
      userIdHash: hashUserId(userId),
      resultCount: results.length,
    });

    return results.slice(0, config.limit);
  }

  // -- 점수 계산 ─────────────────────────────────────────────────────────

  /** 콘텐츠 추천 점수 계산 */
  private calculateScore(
    content: ContentItem,
    profile: UserProfile,
    config: RecommendationConfig,
  ): number {
    let score = 0;

    // 1. 임베딩 유사도 (주요 점수)
    if (profile.embedding && content.embedding) {
      const similarity = cosineSimilarity(profile.embedding, content.embedding);
      score += similarity * (1 - config.popularityWeight - config.recencyWeight);
    }

    // 2. 카테고리 관심도 매칭
    const interest = profile.interests.find(
      (i) => i.category === content.category,
    );
    if (interest) {
      score += interest.score * 0.3;
    }

    // 3. 인기도
    score += (content.popularity / 100) * config.popularityWeight;

    // 4. 최근성
    const ageMs = Date.now() - new Date(content.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-ageDays / 30); // 30일 반감기
    score += recencyScore * config.recencyWeight;

    return score;
  }

  // -- MMR 다양성 보장 ───────────────────────────────────────────────────

  /** Maximal Marginal Relevance -- Design §3 */
  private applyMMR(
    scored: { content: ContentItem; score: number }[],
    config: RecommendationConfig,
  ): RecommendationResult[] {
    const lambda = 1 - config.diversityWeight;
    const selected: RecommendationResult[] = [];
    const remaining = [...scored].sort((a, b) => b.score - a.score);

    while (selected.length < config.limit && remaining.length > 0) {
      let bestIdx = 0;
      let bestMmr = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i]!;
        const relevance = candidate.score;

        // 이미 선택된 것과의 최대 유사도
        let maxSimilarity = 0;
        for (const sel of selected) {
          const selContent = this.contentIndex.get(sel.contentId);
          if (
            selContent?.embedding &&
            candidate.content.embedding
          ) {
            const sim = cosineSimilarity(
              selContent.embedding,
              candidate.content.embedding,
            );
            maxSimilarity = Math.max(maxSimilarity, sim);
          } else if (selContent?.category === candidate.content.category) {
            maxSimilarity = Math.max(maxSimilarity, 0.5);
          }
        }

        const mmr = lambda * relevance - (1 - lambda) * maxSimilarity;
        if (mmr > bestMmr) {
          bestMmr = mmr;
          bestIdx = i;
        }
      }

      const best = remaining.splice(bestIdx, 1)[0]!;
      selected.push({
        contentId: best.content.id,
        score: best.score,
        reason: this.generateReason(best.content),
        algorithm: 'mmr_hybrid',
      });
    }

    return selected;
  }

  /** 추천 사유 생성 */
  private generateReason(content: ContentItem): string {
    return `카테고리 "${content.category}" 관심 기반 추천`;
  }

  // -- A/B 테스트 -- Design §6 ───────────────────────────────────────────

  /** 실험 등록 */
  createExperiment(experiment: Experiment): void {
    this.experiments.set(experiment.id, experiment);
    auditLog('experiment_created', { experimentId: experiment.id });
  }

  /** 실험별 설정 가져오기 (사용자 해시 기반 변형 배정) */
  private getExperimentConfig(userId: string): Partial<RecommendationConfig> | undefined {
    for (const exp of this.experiments.values()) {
      if (!exp.active) continue;

      // 해시 기반 일관된 변형 배정
      const hash = hashUserId(`${exp.id}:${userId}`);
      const hashNum = parseInt(hash.slice(0, 8), 16);
      const totalWeight = exp.variants.reduce((sum, v) => sum + v.weight, 0);
      let accumulated = 0;
      const threshold = hashNum % totalWeight;

      for (const variant of exp.variants) {
        accumulated += variant.weight;
        if (threshold < accumulated) {
          variant.impressions += 1;
          return variant.config;
        }
      }
    }
    return undefined;
  }

  /** 실험 결과 기록 */
  recordExperimentClick(experimentId: string, userId: string): void {
    const exp = this.experiments.get(experimentId);
    if (!exp) return;

    const hash = hashUserId(`${exp.id}:${userId}`);
    const hashNum = parseInt(hash.slice(0, 8), 16);
    const totalWeight = exp.variants.reduce((sum, v) => sum + v.weight, 0);
    let accumulated = 0;
    const threshold = hashNum % totalWeight;

    for (const variant of exp.variants) {
      accumulated += variant.weight;
      if (threshold < accumulated) {
        variant.clicks += 1;
        break;
      }
    }
  }

  /** 실험 결과 요약 */
  getExperimentResults(experimentId: string): ExperimentVariant[] | undefined {
    return this.experiments.get(experimentId)?.variants;
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let engineInstance: PersonalizationEngine | null = null;

export function getPersonalizationEngine(
  config?: Partial<PersonalizationEngineConfig>,
): PersonalizationEngine {
  if (!engineInstance) {
    engineInstance = new PersonalizationEngine(config);
  }
  return engineInstance;
}

export function resetPersonalizationEngine(): void {
  engineInstance = null;
}
