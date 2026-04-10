// 테넌트별 요금제 기반 Rate Limiter
// Design Ref: SVC-RATELIMIT-R19 Plan
// Plan SC: FR-RL.2, FR-RL.3, FR-RL.4
// CSAP: D-10 접근 제어

import { SlidingWindowCounter, type WindowResult } from './sliding-window.js';

/**
 * 요금제 레벨
 */
export type PlanLevel = 'free' | 'standard' | 'enterprise' | 'custom';

/**
 * 요금제별 Rate Limit 설정
 */
export interface PlanConfig {
  /** 분당 요청 한도 */
  requestsPerMinute: number;
  /** 버스트 배율 (한도 대비, 기본: 1.5 = 150%) */
  burstMultiplier?: number;
  /** 큐 최대 크기 (버스트 초과 시, 기본: 0 = 큐잉 없음) */
  maxQueueSize?: number;
}

/**
 * 테넌트 Rate Limit 정보
 */
export interface TenantRateLimitInfo {
  tenantId: string;
  plan: PlanLevel;
  limit: number;
  burstLimit: number;
  result: WindowResult;
  /** 응답 헤더 (RFC 표준) */
  headers: Record<string, string>;
}

/**
 * 한도 근접 알림 콜백
 */
export type ThresholdCallback = (
  tenantId: string,
  percentage: number,
  info: TenantRateLimitInfo,
) => void;

/**
 * TenantRateLimiter 옵션
 */
export interface TenantRateLimiterOptions {
  /** 요금��별 설정 */
  plans?: Partial<Record<PlanLevel, PlanConfig>>;
  /** 테넌트별 커스텀 오버라이드 */
  overrides?: Record<string, PlanConfig>;
  /** 윈도우 크기 (밀리초, 기본: 60000) */
  windowMs?: number;
  /** 알림 임계값 (%, 기본: [80, 90]) */
  thresholds?: number[];
  /** 임계값 도달 콜백 */
  onThreshold?: ThresholdCallback;
}

/** 기본 요금제 설정 */
const DEFAULT_PLANS: Record<PlanLevel, PlanConfig> = {
  free: { requestsPerMinute: 100, burstMultiplier: 1.5, maxQueueSize: 0 },
  standard: { requestsPerMinute: 1_000, burstMultiplier: 1.5, maxQueueSize: 10 },
  enterprise: { requestsPerMinute: 10_000, burstMultiplier: 2.0, maxQueueSize: 50 },
  custom: { requestsPerMinute: 500, burstMultiplier: 1.5, maxQueueSize: 5 },
};

/**
 * 테넌트별 Rate Limiter
 *
 * 요금제 기반 차등 한도 + Sliding Window + 버스트 허용
 */
export class TenantRateLimiter {
  private readonly counter: SlidingWindowCounter;
  private readonly plans: Record<PlanLevel, PlanConfig>;
  private readonly overrides: Record<string, PlanConfig>;
  private readonly thresholds: number[];
  private readonly onThreshold: ThresholdCallback | null;
  /** 이미 알림을 보낸 임계값 추적 (중복 방지) */
  private readonly notifiedThresholds = new Map<string, Set<number>>();

  constructor(options: TenantRateLimiterOptions = {}) {
    this.counter = new SlidingWindowCounter(options.windowMs ?? 60_000);
    this.plans = { ...DEFAULT_PLANS, ...options.plans };
    this.overrides = options.overrides ?? {};
    this.thresholds = options.thresholds ?? [80, 90];
    this.onThreshold = options.onThreshold ?? null;
  }

  /**
   * 요청 처리 시도
   *
   * @param tenantId 테넌트 식별자
   * @param plan 테넌트 요금제 레벨
   * @returns 한도 정보 + 응답 헤더
   */
  tryRequest(tenantId: string, plan: PlanLevel = 'free'): TenantRateLimitInfo {
    const config = this.getConfig(tenantId, plan);
    const limit = config.requestsPerMinute;
    const burstLimit = Math.floor(limit * (config.burstMultiplier ?? 1.5));
    const key = `tenant:${tenantId}`;

    // 먼저 기본 한도로 확인
    const result = this.counter.increment(key, burstLimit);

    const info: TenantRateLimitInfo = {
      tenantId,
      plan,
      limit,
      burstLimit,
      result,
      headers: this.buildHeaders(limit, result),
    };

    // 임계값 알림 확인
    this.checkThresholds(tenantId, limit, result);

    return info;
  }

  /**
   * 현재 상태 조회 (카운트 증가 없음)
   */
  getStatus(tenantId: string, plan: PlanLevel = 'free'): TenantRateLimitInfo {
    const config = this.getConfig(tenantId, plan);
    const limit = config.requestsPerMinute;
    const burstLimit = Math.floor(limit * (config.burstMultiplier ?? 1.5));
    const key = `tenant:${tenantId}`;

    const result = this.counter.peek(key, burstLimit);

    return {
      tenantId,
      plan,
      limit,
      burstLimit,
      result,
      headers: this.buildHeaders(limit, result),
    };
  }

  /**
   * 테넌트 한도 리셋
   */
  resetTenant(tenantId: string): void {
    this.counter.reset(`tenant:${tenantId}`);
    this.notifiedThresholds.delete(tenantId);
  }

  /**
   * 전체 리셋
   */
  resetAll(): void {
    this.counter.resetAll();
    this.notifiedThresholds.clear();
  }

  /**
   * 전체 통계 반환
   */
  getStats(): {
    activeKeys: number;
    plans: Record<PlanLevel, PlanConfig>;
    overrideCount: number;
  } {
    return {
      activeKeys: this.counter.getKeyCount(),
      plans: { ...this.plans },
      overrideCount: Object.keys(this.overrides).length,
    };
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    this.counter.destroy();
    this.notifiedThresholds.clear();
  }

  private getConfig(tenantId: string, plan: PlanLevel): PlanConfig {
    // 커스텀 오버라이드 우선
    if (this.overrides[tenantId]) {
      return this.overrides[tenantId];
    }
    return this.plans[plan] ?? DEFAULT_PLANS.free;
  }

  /**
   * RFC 표준 응답 헤더 생성 (FR-RL.4)
   */
  private buildHeaders(limit: number, result: WindowResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    };

    if (result.exceeded) {
      headers['Retry-After'] = String(Math.ceil(result.retryAfterMs / 1000));
    }

    return headers;
  }

  private checkThresholds(tenantId: string, limit: number, result: WindowResult): void {
    if (!this.onThreshold || limit === 0) return;

    const percentage = Math.floor((result.count / limit) * 100);

    let notified = this.notifiedThresholds.get(tenantId);
    if (!notified) {
      notified = new Set<number>();
      this.notifiedThresholds.set(tenantId, notified);
    }

    for (const threshold of this.thresholds) {
      if (percentage >= threshold && !notified.has(threshold)) {
        notified.add(threshold);
        this.onThreshold(tenantId, threshold, {
          tenantId,
          plan: 'free', // 간소화 -- 실제 plan은 호출자에서 관리
          limit,
          burstLimit: limit,
          result,
          headers: {},
        });
      }
    }

    // 윈도우 리셋되면 알림 상태 초기화
    if (result.count === 0) {
      this.notifiedThresholds.delete(tenantId);
    }
  }
}
