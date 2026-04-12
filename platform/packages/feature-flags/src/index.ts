// Feature Flags -- 공개 API
// Design Ref: SVC-FEATUREFLAG-R40 DESIGN

export { FeatureFlagManager } from './feature-flags.js';
export type {
  FlagDefinition,
  Segment,
  SegmentOperator,
  EvaluationContext,
  EvaluationResult,
} from './feature-flags.js';
