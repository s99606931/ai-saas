// AsyncLocalStorage 기반 추적 컨텍스트 전파
// Plan SC: FR-TC.7, FR-TC.8

import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

const storage = new AsyncLocalStorage<TraceContext>();

/**
 * 주어진 컨텍스트 하에서 비동기 함수 실행
 * Plan SC: FR-TC.8
 */
export function runWithContext<T>(
  ctx: TraceContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn);
}

/** 현재 컨텍스트 조회 */
export function getCurrentContext(): TraceContext | undefined {
  return storage.getStore();
}

/** 현재 traceId 조회 (없으면 undefined) */
export function getCurrentTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}
