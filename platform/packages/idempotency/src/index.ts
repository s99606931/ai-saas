// Idempotency Manager -- 공개 API
// Design Ref: SVC-IDEMPOTENT-R39 DESIGN

export {
  IdempotencyManager,
  MemoryIdempotencyStore,
  withIdempotency,
  IdempotencyConflictError,
  IdempotencyInProgressError,
} from './idempotency.js';

export type {
  IdempotencyState,
  IdempotencyRecord,
  IdempotencyStore,
  IdempotencyOptions,
  BeginResult,
} from './idempotency.js';
