// Design Ref: MTU-N432 §OTel 자동 계측
// Plan SC: FR-N432.1~5

export type LibraryKind = 'http' | 'grpc' | 'postgres' | 'mysql' | 'redis' | 'kafka';

export interface InstrumentationTarget {
  library: LibraryKind;
  module: string;
  version: string;
  hookPoints: string[];
}

export interface TraceContext {
  traceId: string;
  parentSpanId: string;
  traceFlags: number;
}

export interface SpanRecord {
  library: LibraryKind;
  operation: string;
  service: string;
  version: string;
  environment: string;
  startNs: number;
  endNs: number;
  status: 'ok' | 'error';
}

export interface SamplingPolicy {
  baseRate: number;
  errorAmplifier: number;
  maxRatePerSec: number;
}

export interface ExportStats {
  spansExported: number;
  spansDropped: number;
  batchesSent: number;
  lastErrorAt?: string;
}

export class OtelAutoInstrumentation {
  /** FR-N432.1 자동 래핑 대상 등록 */
  registerTargets(targets: InstrumentationTarget[]): Map<LibraryKind, InstrumentationTarget> {
    const map = new Map<LibraryKind, InstrumentationTarget>();
    for (const t of targets) {
      map.set(t.library, t);
    }
    return map;
  }

  /** FR-N432.2 W3C Trace Context 전파 헤더 생성 */
  buildTraceparent(ctx: TraceContext): string {
    const version = '00';
    const flags = ctx.traceFlags.toString(16).padStart(2, '0');
    return `${version}-${ctx.traceId}-${ctx.parentSpanId}-${flags}`;
  }

  parseTraceparent(header: string): TraceContext | null {
    const parts = header.split('-');
    if (parts.length !== 4) return null;
    const [, traceId, spanId, flags] = parts;
    if (!traceId || !spanId || !flags) return null;
    return {
      traceId,
      parentSpanId: spanId,
      traceFlags: parseInt(flags, 16),
    };
  }

  /** FR-N432.3 Span 속성 자동 태깅 */
  tagSpan(
    span: Omit<SpanRecord, 'service' | 'version' | 'environment'>,
    meta: { service: string; version: string; environment: string },
  ): SpanRecord {
    return { ...span, ...meta };
  }

  /** FR-N432.4 동적 샘플링 결정 */
  shouldSample(policy: SamplingPolicy, recentErrorRate: number, currentRatePerSec: number): boolean {
    if (currentRatePerSec >= policy.maxRatePerSec) return false;
    const effectiveRate = Math.min(1, policy.baseRate + recentErrorRate * policy.errorAmplifier);
    return Math.random() < effectiveRate;
  }

  /** FR-N432.5 Export 통계 집계 */
  summarizeExports(exportResults: Array<{ ok: boolean; count: number; error?: string }>): ExportStats {
    let exported = 0;
    let dropped = 0;
    let lastError: string | undefined;
    for (const r of exportResults) {
      if (r.ok) exported += r.count;
      else {
        dropped += r.count;
        if (r.error) lastError = r.error;
      }
    }
    return {
      spansExported: exported,
      spansDropped: dropped,
      batchesSent: exportResults.length,
      ...(lastError ? { lastErrorAt: new Date().toISOString() } : {}),
    };
  }
}

export const otelAutoInstrumentation = new OtelAutoInstrumentation();
