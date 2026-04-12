export { AiImpactAssessor, classifyRisk, mandatoryControls } from './impact-assessment.js';
export type { AiPurpose, RiskLevel, AiSystemInfo, AiaResult } from './impact-assessment.js';

export { ModelCardBuilder, computeFairness } from './model-card.js';
export type {
  ModelMetadata,
  TrainingData,
  PerformanceMetrics,
  FairnessMetrics,
  ModelCard,
} from './model-card.js';

export {
  ExplanationAuditor,
  extractFeatureContributions,
  generateNarrative,
} from './explainability.js';
export type {
  DecisionInput,
  FeatureContribution,
  Explanation,
  ExplanationAuditEntry,
} from './explainability.js';

export { EthicsCommittee, listEthicsPrinciples } from './ethics-committee.js';
export type { EthicsAgenda, Vote, VoteRecord, VoteSummary } from './ethics-committee.js';
