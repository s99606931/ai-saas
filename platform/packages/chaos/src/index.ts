// @public-saas/chaos -- Chaos Engineering 기초 패키지
// Design Ref: SVC-CHAOS-R12 Plan
// CSAP: D-07 가용성

export {
  ChaosEngine,
  type FaultType,
  type FaultConfig,
  type FaultEvent,
} from './chaos-engine.js';

export {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStatus,
} from './circuit-breaker.js';

export {
  chaosPlugin,
  type ChaosPluginOptions,
} from './chaos-plugin.js';

export {
  ResilienceTestRunner,
  ResilienceScenarios,
  type ResilienceScenario,
  type ResilienceResult,
} from './resilience-runner.js';
