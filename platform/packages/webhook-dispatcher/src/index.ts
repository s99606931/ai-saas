// @public-saas/webhook-dispatcher
// Plan Ref: docs/01-plan/mtus/SVC-WEBHOOK-R52.plan.md
// Design Ref: docs/02-design/mtus/SVC-WEBHOOK-R52.design.md

export {
  signPayload,
  verifySignature,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  DEFAULT_TOLERANCE_SECONDS,
  type SignResult,
  type VerifyOptions,
  type VerifyResult,
  type VerifyReason,
} from './signature.js';

export {
  dispatchWebhook,
  computeBackoffDelayMs,
  isRetryableStatus,
} from './dispatcher.js';

export type { DispatchOptions, DispatchResult } from './types.js';
