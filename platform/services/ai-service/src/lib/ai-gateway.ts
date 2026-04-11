// AI 게이트웨이 오케스트레이터 — FR-ADV27.1~27.6
// Design Ref: SVC-AI-ADV-R27 DESIGN §1~§6
// Plan SC: SC-1 (통합 API), SC-2 (제공자 풀), SC-3 (폴백), SC-4 (라우팅), SC-5 (비용)
// CSAP: D-08 제공자별 접근 통제, D-10 사용량 모니터링, D-06 감사
// N2SF: N-05 O등급 데이터만 제공자 전송

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 제공자 상태 — Design §2 */
export type ProviderStatus = 'active' | 'degraded' | 'down' | 'maintenance';

/** LLM 제공자 — Design §2 */
export interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  status: ProviderStatus;
  priority: number;
  maxConcurrency: number;
  currentLoad: number;
  consecutiveErrors: number;
  lastHealthCheck?: string;
}

/** 통합 요청 — Design §1 */
export interface GatewayRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tenantId: string;
  userId: string;
  preferredProvider?: string;
}

/** 통합 응답 */
export interface GatewayResponse {
  id: string;
  text: string;
  model: string;
  provider: string;
  tokensUsed: { input: number; output: number; total: number };
  latencyMs: number;
  cost: number;
  cached: boolean;
}

/** 토큰 단가 테이블 — Design §5 */
export interface TokenPricing {
  provider: string;
  model: string;
  inputPer1K: number;
  outputPer1K: number;
}

/** 사용량 집계 — Design §5 */
export interface UsageSummary {
  tenantId: string;
  period: string;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  providerBreakdown: Record<string, { tokens: number; cost: number; requests: number }>;
}

/** 라우팅 점수 — Design §4 */
export interface RoutingScore {
  providerId: string;
  costScore: number;
  latencyScore: number;
  qualityScore: number;
  totalScore: number;
}

// ── 폴백 체인 — Design §3 ──────────────────────────────────────────────────

const MAX_CONSECUTIVE_ERRORS = 3;

/** 폴백 체인 관리자 */
export class FallbackChain {
  private readonly providers: LLMProvider[] = [];

  /** 제공자 추가 (우선순위 순) */
  addProvider(provider: LLMProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  /** 사용 가능한 다음 제공자 선택 */
  getNextAvailable(excludeIds: string[] = []): LLMProvider | undefined {
    return this.providers.find(
      (p) => p.status === 'active' &&
        !excludeIds.includes(p.id) &&
        p.currentLoad < p.maxConcurrency,
    );
  }

  /** 오류 기록 (서킷 브레이커 연동) */
  recordError(providerId: string): void {
    const provider = this.providers.find((p) => p.id === providerId);
    if (provider) {
      provider.consecutiveErrors++;
      if (provider.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        provider.status = 'down';
      }
    }
  }

  /** 성공 기록 (오류 카운터 리셋) */
  recordSuccess(providerId: string): void {
    const provider = this.providers.find((p) => p.id === providerId);
    if (provider) {
      provider.consecutiveErrors = 0;
      if (provider.status === 'degraded') {
        provider.status = 'active';
      }
    }
  }

  /** 상태 복구 (주기적 헬스 체크 후) */
  recover(providerId: string): void {
    const provider = this.providers.find((p) => p.id === providerId);
    if (provider && provider.status === 'down') {
      provider.status = 'active';
      provider.consecutiveErrors = 0;
    }
  }

  /** 전체 제공자 목록 */
  list(): LLMProvider[] {
    return [...this.providers];
  }
}

// ── 비용 추적 — Design §5 ──────────────────────────────────────────────────

/** 비용 추적기 */
export class CostTracker {
  private readonly pricingTable: Map<string, TokenPricing> = new Map();
  private readonly usageRecords: Array<{
    tenantId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    timestamp: string;
  }> = [];

  /** 가격 설정 */
  setPricing(pricing: TokenPricing): void {
    this.pricingTable.set(`${pricing.provider}:${pricing.model}`, pricing);
  }

  /** 비용 계산 */
  calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.pricingTable.get(`${provider}:${model}`);
    if (!pricing) return 0;
    return (inputTokens / 1000) * pricing.inputPer1K + (outputTokens / 1000) * pricing.outputPer1K;
  }

  /** 사용량 기록 */
  record(
    tenantId: string,
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const cost = this.calculateCost(provider, model, inputTokens, outputTokens);
    this.usageRecords.push({
      tenantId,
      provider,
      model,
      inputTokens,
      outputTokens,
      cost,
      timestamp: new Date().toISOString(),
    });
    return cost;
  }

  /** 테넌트별 사용량 요약 */
  getSummary(tenantId: string, periodPrefix?: string): UsageSummary {
    const filtered = this.usageRecords.filter(
      (r) => r.tenantId === tenantId &&
        (!periodPrefix || r.timestamp.startsWith(periodPrefix)),
    );

    const providerBreakdown: Record<string, { tokens: number; cost: number; requests: number }> = {};

    for (const r of filtered) {
      const existing = providerBreakdown[r.provider] ?? { tokens: 0, cost: 0, requests: 0 };
      existing.tokens += r.inputTokens + r.outputTokens;
      existing.cost += r.cost;
      existing.requests += 1;
      providerBreakdown[r.provider] = existing;
    }

    return {
      tenantId,
      period: periodPrefix ?? new Date().toISOString().slice(0, 10),
      totalTokens: filtered.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
      totalCost: filtered.reduce((s, r) => s + r.cost, 0),
      requestCount: filtered.length,
      providerBreakdown,
    };
  }

  /** 총 기록 수 */
  get size(): number {
    return this.usageRecords.length;
  }
}

// ── 지능형 라우팅 — Design §4 ──────────────────────────────────────────────

/**
 * 라우팅 점수 계산
 * score = cost * 0.3 + latency * 0.3 + quality * 0.4
 */
export function calculateRoutingScore(
  provider: LLMProvider,
  costNormalized: number,
  latencyNormalized: number,
  qualityNormalized: number,
): RoutingScore {
  // 비용과 지연은 낮을수록 좋으므로 반전 (1 - value)
  const costScore = 1 - costNormalized;
  const latencyScore = 1 - latencyNormalized;
  const qualityScore = qualityNormalized;

  const totalScore = costScore * 0.3 + latencyScore * 0.3 + qualityScore * 0.4;

  return {
    providerId: provider.id,
    costScore: Math.round(costScore * 1000) / 1000,
    latencyScore: Math.round(latencyScore * 1000) / 1000,
    qualityScore: Math.round(qualityScore * 1000) / 1000,
    totalScore: Math.round(totalScore * 1000) / 1000,
  };
}

/**
 * 최적 제공자 선택
 */
export function selectBestProvider(
  providers: LLMProvider[],
  scoreFn: (provider: LLMProvider) => RoutingScore,
): { provider: LLMProvider; score: RoutingScore } | undefined {
  let best: { provider: LLMProvider; score: RoutingScore } | undefined;

  for (const provider of providers) {
    if (provider.status !== 'active') continue;
    if (provider.currentLoad >= provider.maxConcurrency) continue;

    const score = scoreFn(provider);
    if (!best || score.totalScore > best.score.totalScore) {
      best = { provider, score };
    }
  }

  return best;
}
