// AI 속도 제한 + 할당량 관리 — FR-ADV15.1~FR-ADV15.6
// Design Ref: SVC-AI-ADV-R15 DESIGN §1~§4
// CSAP: D-10 리소스 사용량 제한, D-06 감사 로깅

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 요청 우선순위 — FR-ADV15.4 */
export type RequestPriority = 'high' | 'normal' | 'low';

/** 속도 제한 설정 */
export interface RateLimitConfig {
  /** 분당 최대 요청 수 (RPM) */
  requestsPerMinute: number;
  /** 분당 최대 토큰 수 (TPM) */
  tokensPerMinute: number;
  /** 토큰 버킷 최대 용량 (버스트) */
  bucketCapacity: number;
  /** 초당 토큰 보충량 */
  refillRatePerSecond: number;
}

/** 테넌트 등급별 기본 설정 */
export type TenantTier = 'basic' | 'standard' | 'premium' | 'enterprise';

/** 속도 제한 확인 결과 */
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
  remainingRequests: number;
  remainingTokens: number;
  priority: RequestPriority;
}

/** 남용 감지 결과 — FR-ADV15.6 */
export interface AbuseDetectionResult {
  isAbuse: boolean;
  reason?: string;
  severity?: 'warning' | 'block';
  pattern?: string;
}

// ── 기본 설정 ────────────────────────────────────────────────────────────────

const TIER_CONFIGS: Record<TenantTier, RateLimitConfig> = {
  basic: { requestsPerMinute: 10, tokensPerMinute: 10_000, bucketCapacity: 20, refillRatePerSecond: 0.17 },
  standard: { requestsPerMinute: 30, tokensPerMinute: 50_000, bucketCapacity: 60, refillRatePerSecond: 0.5 },
  premium: { requestsPerMinute: 100, tokensPerMinute: 200_000, bucketCapacity: 200, refillRatePerSecond: 1.67 },
  enterprise: { requestsPerMinute: 500, tokensPerMinute: 1_000_000, bucketCapacity: 1000, refillRatePerSecond: 8.33 },
};

// ── 슬라이딩 윈도우 — FR-ADV15.1 ────────────────────────────────────────────

/** 슬라이딩 윈도우 카운터 */
class SlidingWindowCounter {
  private readonly windowMs: number;
  private readonly timestamps: number[] = [];

  constructor(windowMs: number = 60_000) {
    this.windowMs = windowMs;
  }

  /** 현재 윈도우 내 카운트 */
  count(): number {
    this.cleanup();
    return this.timestamps.length;
  }

  /** 이벤트 기록 */
  record(): void {
    this.timestamps.push(Date.now());
    this.cleanup();
  }

  /** 다음 허용 시각까지 대기 시간 (ms) */
  retryAfterMs(limit: number): number {
    this.cleanup();
    if (this.timestamps.length < limit) return 0;
    const oldest = this.timestamps[0] ?? Date.now();
    return Math.max(0, oldest + this.windowMs - Date.now());
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.timestamps.length > 0 && (this.timestamps[0] ?? 0) < cutoff) {
      this.timestamps.shift();
    }
  }
}

// ── 토큰 버킷 — FR-ADV15.2 ─────────────────────────────────────────────────

/** 토큰 버킷 알고리즘 */
class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number; // 토큰/초
  private lastRefill: number;

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.tokens = capacity; // 시작 시 가득 참
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  /** 토큰 소비 시도 */
  tryConsume(amount: number): boolean {
    this.refill();
    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }
    return false;
  }

  /** 현재 가용 토큰 */
  available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /** 토큰 보충 (경과 시간 기반) */
  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillRate);
    this.lastRefill = now;
  }
}

// ── AI 속도 제한기 ──────────────────────────────────────────────────────────

/** 테넌트별 속도 제한 상태 */
interface TenantRateLimitState {
  requestWindow: SlidingWindowCounter;
  tokenWindow: SlidingWindowCounter;
  tokenBucket: TokenBucket;
  config: RateLimitConfig;
  tier: TenantTier;
  /** 남용 감지: 최근 요청 간격 (ms) */
  recentIntervals: number[];
  lastRequestTime: number;
  blockedUntil: number;
}

/**
 * AI 속도 제한기 + 할당량 관리자
 *
 * 테넌트별로 AI API 호출 속도와 할당량을 정밀 제어합니다.
 *
 * 특징:
 * - 슬라이딩 윈도우 RPM/TPM 제한
 * - 토큰 버킷으로 버스트 허용
 * - 테넌트 등급별 차등 할당
 * - 우선순위 기반 처리
 * - 남용 자동 감지
 */
export class AIRateLimiter {
  private readonly states: Map<string, TenantRateLimitState> = new Map();

  // 메트릭
  private totalRequests = 0;
  private blockedRequests = 0;

  /** 남용 감지 콜백 */
  onAbuseDetected?: (tenantId: string, result: AbuseDetectionResult) => void;

  /**
   * 테넌트 등급을 설정합니다 — FR-ADV15.3
   */
  setTenantTier(tenantId: string, tier: TenantTier): void {
    const config = TIER_CONFIGS[tier];
    const state = this.getOrCreateState(tenantId, tier);
    state.config = config;
    state.tier = tier;
    state.tokenBucket = new TokenBucket(config.bucketCapacity, config.refillRatePerSecond);
  }

  /**
   * 요청 허용 여부를 확인합니다
   */
  checkRateLimit(
    tenantId: string,
    estimatedTokens: number = 100,
    priority: RequestPriority = 'normal',
  ): RateLimitResult {
    this.totalRequests++;
    const state = this.getOrCreateState(tenantId, 'standard');

    // 차단 상태 확인 (남용 감지)
    if (state.blockedUntil > Date.now()) {
      this.blockedRequests++;
      return {
        allowed: false,
        reason: `남용 감지로 차단됨 (${new Date(state.blockedUntil).toISOString()}까지)`,
        retryAfterMs: state.blockedUntil - Date.now(),
        remainingRequests: 0,
        remainingTokens: 0,
        priority,
      };
    }

    // 우선순위 보정 — FR-ADV15.4
    const effectiveConfig = this.applyPriorityBoost(state.config, priority);

    // RPM 확인 — FR-ADV15.1
    if (state.requestWindow.count() >= effectiveConfig.requestsPerMinute) {
      this.blockedRequests++;
      return {
        allowed: false,
        reason: `분당 요청 한도 초과 (${effectiveConfig.requestsPerMinute} RPM)`,
        retryAfterMs: state.requestWindow.retryAfterMs(effectiveConfig.requestsPerMinute),
        remainingRequests: 0,
        remainingTokens: state.tokenBucket.available(),
        priority,
      };
    }

    // 토큰 버킷 확인 — FR-ADV15.2
    if (!state.tokenBucket.tryConsume(estimatedTokens)) {
      this.blockedRequests++;
      return {
        allowed: false,
        reason: `토큰 버킷 소진 (요청: ${estimatedTokens}, 가용: ${state.tokenBucket.available()})`,
        retryAfterMs: Math.ceil(estimatedTokens / state.config.refillRatePerSecond) * 1000,
        remainingRequests: effectiveConfig.requestsPerMinute - state.requestWindow.count(),
        remainingTokens: state.tokenBucket.available(),
        priority,
      };
    }

    // 요청 기록
    state.requestWindow.record();

    // 남용 감지 — FR-ADV15.6
    this.detectAbuse(tenantId, state);

    return {
      allowed: true,
      remainingRequests: effectiveConfig.requestsPerMinute - state.requestWindow.count(),
      remainingTokens: state.tokenBucket.available(),
      priority,
    };
  }

  /**
   * 실제 사용 토큰을 기록합니다 (요청 완료 후)
   */
  recordUsage(tenantId: string, _actualTokens: number): void {
    const state = this.states.get(tenantId);
    if (state) {
      state.tokenWindow.record();
    }
  }

  /**
   * 속도 제한 상태를 조회합니다
   */
  getStatus(tenantId: string): {
    tier: TenantTier;
    requestsUsed: number;
    requestsLimit: number;
    tokensAvailable: number;
    tokensCapacity: number;
    isBlocked: boolean;
  } {
    const state = this.getOrCreateState(tenantId, 'standard');
    return {
      tier: state.tier,
      requestsUsed: state.requestWindow.count(),
      requestsLimit: state.config.requestsPerMinute,
      tokensAvailable: state.tokenBucket.available(),
      tokensCapacity: state.config.bucketCapacity,
      isBlocked: state.blockedUntil > Date.now(),
    };
  }

  /**
   * 전체 메트릭
   */
  getMetrics(): { totalRequests: number; blockedRequests: number; blockRate: number } {
    return {
      totalRequests: this.totalRequests,
      blockedRequests: this.blockedRequests,
      blockRate: this.totalRequests > 0 ? this.blockedRequests / this.totalRequests : 0,
    };
  }

  // ── 내부 메서드 ────────────────────────────────────────────────────

  private getOrCreateState(tenantId: string, defaultTier: TenantTier): TenantRateLimitState {
    let state = this.states.get(tenantId);
    if (!state) {
      const config = TIER_CONFIGS[defaultTier];
      state = {
        requestWindow: new SlidingWindowCounter(),
        tokenWindow: new SlidingWindowCounter(),
        tokenBucket: new TokenBucket(config.bucketCapacity, config.refillRatePerSecond),
        config,
        tier: defaultTier,
        recentIntervals: [],
        lastRequestTime: 0,
        blockedUntil: 0,
      };
      this.states.set(tenantId, state);
    }
    return state;
  }

  /** 우선순위 보정 — FR-ADV15.4 */
  private applyPriorityBoost(config: RateLimitConfig, priority: RequestPriority): RateLimitConfig {
    switch (priority) {
      case 'high':
        return { ...config, requestsPerMinute: Math.floor(config.requestsPerMinute * 1.5) };
      case 'low':
        return { ...config, requestsPerMinute: Math.floor(config.requestsPerMinute * 0.5) };
      default:
        return config;
    }
  }

  /** 남용 감지 — FR-ADV15.6 */
  private detectAbuse(tenantId: string, state: TenantRateLimitState): void {
    const now = Date.now();
    if (state.lastRequestTime > 0) {
      const interval = now - state.lastRequestTime;
      state.recentIntervals.push(interval);

      // 최근 20개만 유지
      if (state.recentIntervals.length > 20) {
        state.recentIntervals.shift();
      }

      // 패턴 분석: 평균 간격 100ms 미만 = 봇 의심
      if (state.recentIntervals.length >= 10) {
        const avgInterval = state.recentIntervals.reduce((s, i) => s + i, 0) / state.recentIntervals.length;

        if (avgInterval < 100) {
          const result: AbuseDetectionResult = {
            isAbuse: true,
            reason: `비정상적 요청 패턴: 평균 간격 ${avgInterval.toFixed(0)}ms`,
            severity: avgInterval < 50 ? 'block' : 'warning',
            pattern: 'rapid_fire',
          };

          this.onAbuseDetected?.(tenantId, result);

          if (result.severity === 'block') {
            state.blockedUntil = now + 300_000; // 5분 차단
          }
        }
      }
    }
    state.lastRequestTime = now;
  }
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

export function createAIRateLimiter(): AIRateLimiter {
  return new AIRateLimiter();
}
