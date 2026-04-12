// @public-saas/trace-context -- public exports
// Design Ref: docs/02-design/mtus/SVC-TRACECTX-R45.design.md

export {
  generateTraceId,
  generateSpanId,
  parseTraceparent,
  buildTraceparent,
  type Traceparent,
} from './trace-id.js';

export {
  sanitizeAttributes,
  DEFAULT_DENY_PATTERNS,
  type SanitizeOptions,
} from './attributes.js';

export {
  runWithContext,
  getCurrentContext,
  getCurrentTraceId,
  type TraceContext,
} from './context.js';

export {
  withSpan,
  setSpanAdapter,
  getSpanAdapter,
  NoopSpanAdapter,
  type SpanHandle,
  type SpanAdapter,
} from './span.js';
