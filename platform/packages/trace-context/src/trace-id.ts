// W3C traceparent 파싱/생성 + ID 생성
// Plan SC: FR-TC.1, FR-TC.2, FR-TC.3
// Design Ref: §알고리즘 parseTraceparent

import { randomBytes } from 'node:crypto';

export interface Traceparent {
  version: string;
  traceId: string;
  spanId: string;
  flags: string;
}

const HEX32 = /^[0-9a-f]{32}$/;
const HEX16 = /^[0-9a-f]{16}$/;
const HEX2 = /^[0-9a-f]{2}$/;
const ZERO_TRACE = '0'.repeat(32);
const ZERO_SPAN = '0'.repeat(16);

/** 16바이트(32 hex) traceId 생성 */
export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

/** 8바이트(16 hex) spanId 생성 */
export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * W3C traceparent 헤더 파싱
 * 형식: version-traceId-spanId-flags (예: 00-abc...-def...-01)
 */
export function parseTraceparent(header: string): Traceparent | undefined {
  if (typeof header !== 'string') return undefined;
  const parts = header.trim().split('-');
  if (parts.length !== 4) return undefined;
  const [version, traceId, spanId, flags] = parts as [
    string,
    string,
    string,
    string,
  ];
  if (!HEX2.test(version)) return undefined;
  if (!HEX32.test(traceId)) return undefined;
  if (!HEX16.test(spanId)) return undefined;
  if (!HEX2.test(flags)) return undefined;
  if (traceId === ZERO_TRACE) return undefined;
  if (spanId === ZERO_SPAN) return undefined;
  return { version, traceId, spanId, flags };
}

/** W3C traceparent 헤더 생성 */
export function buildTraceparent(
  traceId: string,
  spanId: string,
  flags = '01',
): string {
  if (!HEX32.test(traceId)) {
    throw new Error('traceId must be 32 lowercase hex characters');
  }
  if (!HEX16.test(spanId)) {
    throw new Error('spanId must be 16 lowercase hex characters');
  }
  return `00-${traceId}-${spanId}-${flags}`;
}
