// Rate Limiter -- Sliding Window Counter
// Design Ref: SVC-RATELIMIT-R27 DESIGN
// Plan SC: FR-RL.1, FR-RL.2, FR-RL.3, FR-RL.4, FR-RL.5
// CSAP: D-08 접근 통제

/**
 * Rate Limiter 옵션
 */
export interface RateLimiterOptions {
  /** 윈도우 크기 (밀리초, 기본: 60000) */
  windowMs: number;
  /** 윈도우당 최대 요청 수 (기본: 100) */
  maxRequests: number;
}

/**
 * Rate Limit 판정 결과
 */
export interface RateLimitResult {
  /** 요청 허용 여부 */
  allowed: boolean;
  /** 최대 허용 수 */
  limit: number;
  /** 잔여 허용 수 */
  remaining: number;
  /** 윈도우 리셋 타임스탬프 (밀리초) */
  resetAt: number;
  /** 재시도 대기 시간 (초, 거부 시만) */
  retryAfter?: number;
}

/**
 * 윈도우 상태 (키별 독립 관리)
 */
interface WindowState {
  currentCount: number;
  previousCount: number;
  windowStart: number;
}

/**
 * Sliding Window Counter Rate Limiter
 *
 * Fixed Window의 경계 버스트 문제를 해결하는 알고리즘입니다.
 * 현재 윈도우 카운트 + (이전 윈도우 카운트 * 이전 윈도우 잔여 비율)로
 * 가중 요청 수를 계산합니다.
 *
 * 각 키(테넌트)별 독립 윈도우를 관리하여 공정한 리소스 배분을 보장합니다.
 *
 * CSAP D-08: 접근 통제 (API 남용 방지)
 *
 * Plan SC: FR-RL.1 (알고리즘), FR-RL.2 (테넌트 분리)
 */
export class RateLimiter {
  private windows: Map<string, WindowState> = new Map();
  private options: RateLimiterOptions;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: Partial<RateLimiterOptions> = {}) {
    this.options = {
      windowMs: options.windowMs ?? 60_000,
      maxRequests: options.maxRequests ?? 100,
    };

    // 만료된 윈도우 주기적 정리 (메모리 누수 방지)
    // Plan SC: FR-RL.2
    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      this.options.windowMs * 2,
    );
    // unref하여 이벤트 루프 차단 방지
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * 요청 허용 여부 판정 + 카운터 증가
   * Plan SC: FR-RL.1, FR-RL.3
   */
  consume(key: string, now?: number): RateLimitResult {
    const currentTime = now ?? Date.now();
    const state = this.getOrCreateWindow(key, currentTime);
    this.advanceWindow(state, currentTime);

    const weightedCount = this.calculateWeightedCount(state, currentTime);
    const windowEnd = state.windowStart + this.options.windowMs;

    if (weightedCount >= this.options.maxRequests) {
      const retryAfterSec = Math.ceil((windowEnd - currentTime) / 1000);
      return {
        allowed: false,
        limit: this.options.maxRequests,
        remaining: 0,
        resetAt: windowEnd,
        retryAfter: Math.max(retryAfterSec, 1),
      };
    }

    // 요청 허용: 카운터 증가
    state.currentCount++;

    const newWeighted = this.calculateWeightedCount(state, currentTime);
    const remaining = Math.max(
      0,
      Math.floor(this.options.maxRequests - newWeighted),
    );

    return {
      allowed: true,
      limit: this.options.maxRequests,
      remaining,
      resetAt: windowEnd,
    };
  }

  /**
   * 현재 Rate Limit 상태 조회 (카운터 증가 없음)
   * Plan SC: FR-RL.4
   */
  peek(key: string, now?: number): RateLimitResult {
    const currentTime = now ?? Date.now();
    const state = this.windows.get(key);

    if (!state) {
      return {
        allowed: true,
        limit: this.options.maxRequests,
        remaining: this.options.maxRequests,
        resetAt: currentTime + this.options.windowMs,
      };
    }

    this.advanceWindow(state, currentTime);
    const weightedCount = this.calculateWeightedCount(state, currentTime);
    const windowEnd = state.windowStart + this.options.windowMs;
    const remaining = Math.max(
      0,
      Math.floor(this.options.maxRequests - weightedCount),
    );

    return {
      allowed: weightedCount < this.options.maxRequests,
      limit: this.options.maxRequests,
      remaining,
      resetAt: windowEnd,
    };
  }

  /**
   * 특정 키의 카운터 리셋
   * Plan SC: FR-RL.5
   */
  reset(key: string): void {
    this.windows.delete(key);
  }

  /**
   * 모든 키의 카운터 리셋
   * Plan SC: FR-RL.5
   */
  resetAll(): void {
    this.windows.clear();
  }

  /**
   * 설정 동적 변경
   * Plan SC: FR-RL.5
   */
  updateOptions(options: Partial<RateLimiterOptions>): void {
    if (options.windowMs !== undefined) {
      this.options.windowMs = options.windowMs;
    }
    if (options.maxRequests !== undefined) {
      this.options.maxRequests = options.maxRequests;
    }
  }

  /**
   * 현재 추적 중인 키 수
   */
  getActiveKeyCount(): number {
    return this.windows.size;
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.windows.clear();
  }

  // -- 내부 메서드 --

  private getOrCreateWindow(key: string, now: number): WindowState {
    let state = this.windows.get(key);
    if (!state) {
      state = {
        currentCount: 0,
        previousCount: 0,
        windowStart: now,
      };
      this.windows.set(key, state);
    }
    return state;
  }

  /**
   * 윈도우 시간 경과 시 슬라이딩 처리
   */
  private advanceWindow(state: WindowState, now: number): void {
    const elapsed = now - state.windowStart;

    if (elapsed >= this.options.windowMs * 2) {
      // 2윈도우 이상 경과: 완전 리셋
      state.previousCount = 0;
      state.currentCount = 0;
      state.windowStart = now;
    } else if (elapsed >= this.options.windowMs) {
      // 1윈도우 경과: 이전→현재 이동
      state.previousCount = state.currentCount;
      state.currentCount = 0;
      state.windowStart = state.windowStart + this.options.windowMs;
    }
  }

  /**
   * Sliding Window Counter 가중 카운트 계산
   *
   * 가중 카운트 = 현재 윈도우 카운트 + (이전 윈도우 카운트 * 이전 윈도우 잔여 비율)
   * Plan SC: FR-RL.1
   */
  private calculateWeightedCount(state: WindowState, now: number): number {
    const elapsed = now - state.windowStart;
    const windowProgress = Math.min(elapsed / this.options.windowMs, 1);
    const previousWeight = 1 - windowProgress;

    return state.currentCount + state.previousCount * previousWeight;
  }

  /**
   * 만료된 윈도우 정리 (메모리 누수 방지)
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = this.options.windowMs * 2;

    for (const [key, state] of this.windows) {
      if (now - state.windowStart > maxAge) {
        this.windows.delete(key);
      }
    }
  }
}
