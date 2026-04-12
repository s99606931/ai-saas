export {
  ParticipantRegistry,
  FederatedCoordinator,
  fedAvgAggregate,
} from './coordinator.js';
export type {
  Participant,
  ModelUpdate,
  GlobalModel,
  RoundSummary,
  RoundAuditEntry,
} from './coordinator.js';

export {
  PrivacyBudget,
  DpQueryAuditor,
  laplaceNoise,
  gaussianNoise,
  privateCount,
  privateSum,
  synthesizeHistogram,
} from './differential-privacy.js';
export type { DpBudget, DpQueryRecord } from './differential-privacy.js';

export {
  fedProxAggregate,
  scaffoldAggregate,
  recommendStrategy,
  computeStrategyMetrics,
} from './strategies.js';
export type { StrategyName, StrategyMetrics } from './strategies.js';

export {
  ContributionAuditor,
  shapleyApproximation,
  detectAnomalies,
} from './contribution-audit.js';
export type { ContributionScore, RewardEntry } from './contribution-audit.js';
