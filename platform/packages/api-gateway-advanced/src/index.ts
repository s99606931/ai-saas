// @public-saas/api-gateway-advanced 패키지 엔트리포인트
// Design Ref: SVC-APIGW-R22 Plan
// Plan SC: FR-GW.1

export {
  ResponseCache,
  buildCacheKey,
  type CacheStats,
  type ResponseCacheOptions,
} from './response-cache.js';
export {
  UsageAnalytics,
  type RequestRecord,
  type EndpointStats,
  type UsageReport,
  type UsageAnalyticsOptions,
} from './usage-analytics.js';
export {
  RequestAggregator,
  type AggregationTarget,
  type AggregationResult,
  type RequestAggregatorOptions,
} from './request-aggregator.js';
export {
  gatewayPlugin,
  type GatewayPluginOptions,
} from './gateway-plugin.js';
