// @public-saas/rate-limit-advanced 패키지 엔트리포인트
// Design Ref: SVC-RATELIMIT-R19 Plan
// Plan SC: FR-RL.1

export {
  SlidingWindowCounter,
  type WindowResult,
} from './sliding-window.js';
export {
  TenantRateLimiter,
  type PlanLevel,
  type PlanConfig,
  type TenantRateLimitInfo,
  type TenantRateLimiterOptions,
  type ThresholdCallback,
} from './tenant-rate-limiter.js';
export {
  rateLimitAdvancedPlugin,
  type RateLimitAdvancedPluginOptions,
  type KeyStrategy,
} from './rate-limit-plugin.js';
