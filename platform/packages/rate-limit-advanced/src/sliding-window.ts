// Sliding Window Counter 알고리즘
// Design Ref: SVC-RATELIMIT-R19 Plan
// Plan SC: FR-RL.1
// CSAP: D-10 접근 제어

/**
 * Sliding Window Counter 결과
 */
export interface WindowResult {
  /** 현재 추정 요청 수 */
  count: number;
  /** 한도 */
  limit: number;
  /** 잔여 요청 수 */
  remaining: number;
  /** 리셋 시각 (Unix timestamp, 밀리초) */
  resetAt: number;
  /** 한도 초과 여부 */
  exceeded: boolean;
  /** 대기 시간 (밀리초, 초과 시에만 유의미) */
  retryAfterMs: number;
}

/**
 * 윈도우 상태 (내부)
 */
interface WindowState {
  /** 현재 윈도우 시작 시각 */
  windowStart: number;
  /** 현재 윈도우 카운트 */
  currentCount: number;
  /** 이전 윈도우 카운트 */
  previousCount: number;
}

/**
 * Sliding Window Counter
 *
 * 현재 윈도우 카운트 + (이전 윈도우 카운트 x 이전 윈도우 잔여 비율)로
 * 정밀한 요청 수를 추정합니다.
 *
 * Fixed Window 대비 장점:
 * - 윈도우 경계에서의 버스트 문제 완화
 * - 더 균등한 요청 분포
 */
export class SlidingWindowCounter {
  /** 윈도우 크기 (밀리초) */
  private readonly windowMs: number;
  /** 키별 윈도우 상태 */
  private readonly states = new Map<string, WindowState>();
  /** 만료된 엔트리 정리 인터벌 */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(windowMs: number = 60_000) {
    this.windowMs = windowMs;
    // 5분마다 만료된 엔트리 정리
    this.cleanupInterval = setInterval(() => this.cleanup(), 300_000);
  }

  /**
   * 요청을 기록하고 현재 상태를 반환
   *
   * @param key 식별 키 (IP, 테넌트 ID 등)
   * @param limit 허용 한도
   * @param now 현재 시각 (테스트용 오버라이드)
   */
  increment(key: string, limit: number, now: number = Date.now()): WindowResult {
    const state = this.getOrCreateState(key, now);
    this.rotateWindow(state, now);

    // 현재 추정 카운트 계산 (Sliding Window 공식)
    const elapsed = now - state.windowStart;
    const previousWeight = Math.max(0, 1 - elapsed / this.windowMs);
    const estimatedCount = state.currentCount + Math.floor(state.previousCount * previousWeight);

    if (estimatedCount >= limit) {
      // 한도 초과
      const resetAt = state.windowStart + this.windowMs;
      return {
        count: estimatedCount,
        limit,
        remaining: 0,
        resetAt,
        exceeded: true,
        retryAfterMs: Math.max(0, resetAt - now),
      };
    }

    // 요청 허용 -- 카운트 증가
    state.currentCount++;
    const newEstimate = state.currentCount + Math.floor(state.previousCount * previousWeight);
    const resetAt = state.windowStart + this.windowMs;

    return {
      count: newEstimate,
      limit,
      remaining: Math.max(0, limit - newEstimate),
      resetAt,
      exceeded: false,
      retryAfterMs: 0,
    };
  }

  /**
   * 현재 상태만 조회 (카운트 증가 없음)
   */
  peek(key: string, limit: number, now: number = Date.now()): WindowResult {
    const state = this.states.get(key);
    if (!state) {
      return {
        count: 0,
        limit,
        remaining: limit,
        resetAt: now + this.windowMs,
        exceeded: false,
        retryAfterMs: 0,
      };
    }

    // peek에서도 윈도우 회전 적용 (시간 경과 반영)
    this.rotateWindow(state, now);

    const elapsed = now - state.windowStart;
    const previousWeight = Math.max(0, 1 - elapsed / this.windowMs);
    const estimatedCount = state.currentCount + Math.floor(state.previousCount * previousWeight);
    const resetAt = state.windowStart + this.windowMs;

    return {
      count: estimatedCount,
      limit,
      remaining: Math.max(0, limit - estimatedCount),
      resetAt,
      exceeded: estimatedCount >= limit,
      retryAfterMs: estimatedCount >= limit ? Math.max(0, resetAt - now) : 0,
    };
  }

  /**
   * 특정 키의 상태 리셋
   */
  reset(key: string): void {
    this.states.delete(key);
  }

  /**
   * 전체 상태 리셋
   */
  resetAll(): void {
    this.states.clear();
  }

  /**
   * 추적 중인 키 수 반환
   */
  getKeyCount(): number {
    return this.states.size;
  }

  /**
   * 리소스 정리 (인터벌 해제)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.states.clear();
  }

  private getOrCreateState(key: string, now: number): WindowState {
    let state = this.states.get(key);
    if (!state) {
      state = {
        windowStart: now,
        currentCount: 0,
        previousCount: 0,
      };
      this.states.set(key, state);
    }
    return state;
  }

  private rotateWindow(state: WindowState, now: number): void {
    const windowAge = now - state.windowStart;

    if (windowAge >= this.windowMs * 2) {
      // 2개 윈도우 이상 지남 -- 완전 리셋
      state.previousCount = 0;
      state.currentCount = 0;
      state.windowStart = now;
    } else if (windowAge >= this.windowMs) {
      // 1개 윈도우 지남 -- 현재 → 이전으로 이동
      state.previousCount = state.currentCount;
      state.currentCount = 0;
      state.windowStart = state.windowStart + this.windowMs;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs * 3; // 3개 윈도우 이상 오래된 것 제거
    for (const [key, state] of this.states) {
      if (state.windowStart < cutoff) {
        this.states.delete(key);
      }
    }
  }
}
