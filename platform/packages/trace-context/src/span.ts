// withSpan 래퍼 + OTel optional adapter
// Plan SC: FR-TC.4, FR-TC.5
// Design Ref: §알고리즘 withSpan

import { sanitizeAttributes } from './attributes.js';

export interface SpanHandle {
  setAttribute(key: string, value: unknown): void;
  recordException(err: Error): void;
  end(): void;
}

export interface SpanAdapter {
  start(name: string, attrs?: Record<string, unknown>): SpanHandle;
}

/**
 * OTel 미설치 시 사용되는 no-op 어댑터
 * Plan SC: FR-TC.5
 */
export class NoopSpanAdapter implements SpanAdapter {
  start(_name: string, _attrs?: Record<string, unknown>): SpanHandle {
    return {
      setAttribute: () => undefined,
      recordException: () => undefined,
      end: () => undefined,
    };
  }
}

let currentAdapter: SpanAdapter = new NoopSpanAdapter();

/** 외부에서 OTel 어댑터 주입 (observability 패키지에서 호출) */
export function setSpanAdapter(adapter: SpanAdapter): void {
  currentAdapter = adapter;
}

export function getSpanAdapter(): SpanAdapter {
  return currentAdapter;
}

/**
 * withSpan 래퍼: span 생성 → fn 실행 → 에러 시 recordException → 항상 end
 * Plan SC: FR-TC.4
 */
export async function withSpan<T>(
  name: string,
  fn: (span: SpanHandle) => Promise<T>,
  attrs?: Record<string, unknown>,
): Promise<T> {
  const safeAttrs = sanitizeAttributes(attrs);
  const span = currentAdapter.start(name, safeAttrs);
  try {
    return await fn(span);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    span.recordException(error);
    throw err;
  } finally {
    span.end();
  }
}
