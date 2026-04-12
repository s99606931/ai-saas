// Backoff -- 공개 API
// Design Ref: SVC-BACKOFF-R42 DESIGN

export {
  calculateDelay,
  executeWithRetry,
  isTransientHttpError,
  RetryAbortedError,
  RetryExhaustedError,
} from './backoff.js';

export type {
  BackoffOptions,
  RetryOptions,
  RetryContext,
  JitterStrategy,
} from './backoff.js';
