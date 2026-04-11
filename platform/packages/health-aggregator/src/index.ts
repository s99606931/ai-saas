// @public-saas/health-aggregator 패키지 엔트리포인트
// Design Ref: SVC-HEALTHAGG-R23 Plan
// Plan SC: FR-HA.1

export {
  HealthAggregator,
  type HealthStatus,
  type HealthChecker,
  type HealthCheckResult,
  type ServiceDefinition,
  type ServiceStatus,
  type HealthHistoryEntry,
  type AggregateHealthResult,
  type HealthAggregatorOptions,
} from './health-aggregator.js';
export {
  healthPlugin,
  type HealthPluginOptions,
} from './health-plugin.js';
