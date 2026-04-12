export {
  validateManifest,
  enforcePolicy,
  EdgeDeploymentQueue,
  RuntimeMetricAggregator,
} from './wasm-runtime.js';
export type {
  WasmCapability,
  WasmManifest,
  SandboxPolicy,
  DeploymentEntry,
  RuntimeMetric,
} from './wasm-runtime.js';

export {
  scanForClassicalAlgos,
  hybridTlsConfig,
  buildMigrationPlan,
  testVectors,
} from './pqc-migration.js';
export type { ClassicalAlgo, PqcAlgo, AlgoUsage, MigrationPlanEntry } from './pqc-migration.js';

export {
  analyzeTraffic,
  computeTimeouts,
  computeCircuitBreaker,
  computeMtls,
  buildResiliencyPolicy,
  renderVirtualServiceYaml,
  renderDestinationRuleYaml,
} from './service-mesh.js';
export type { TrafficSample, ResiliencyPolicy } from './service-mesh.js';
