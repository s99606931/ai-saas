// LLM Distributed Trace — FR-R67.1~R67.5
// Design Ref: SVC-AI-ADV-R67 DESIGN §모듈
// Plan SC: 병목 자동 식별, OTel 호환
// CSAP: D-06 감사 / D-09 저장 통제
// N2SF: N-05 등급

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type DataGrade = 'C' | 'S' | 'O';
export type SpanKind = 'llm' | 'retriever' | 'rerank' | 'tool' | 'embed' | 'custom';
export type SpanStatus = 'ok' | 'error' | 'unset';

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

export interface Span {
  id: string;
  traceId: string;
  parentId: string | null;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  attributes: SpanAttributes;
  status: SpanStatus;
  errorMessage?: string;
}

export interface TraceStats {
  traceId: string;
  totalMs: number;
  spanCount: number;
  bottleneck: Span;
  breakdown: Partial<Record<SpanKind, number>>;
}

export interface TracerConfig {
  grade: DataGrade;
  /** 본문 샘플링 허용 (O 등급에서도 기본 false) */
  allowBodySampling?: boolean;
}

export type TraceAuditAction =
  | 'TRACE_START'
  | 'SPAN_START'
  | 'SPAN_END'
  | 'TRACE_EXPORT'
  | 'GRADE_BLOCK'
  | 'TRACE_ANALYZE';

export interface TraceAuditEntry {
  timestamp: string;
  action: TraceAuditAction;
  traceId?: string;
  spanId?: string;
  reason?: string;
}

// ── 본문 금지 키 ─────────────────────────────────────────────────────────────

const BODY_FORBIDDEN_KEYS = new Set([
  'llm.prompt.body',
  'llm.completion.body',
  'llm.request.body',
  'llm.response.body',
]);

// ── 메인 클래스 ──────────────────────────────────────────────────────────────

export class LLMTracer {
  private readonly grade: DataGrade;
  private readonly allowBodySampling: boolean;
  private readonly spans = new Map<string, Span>();
  private readonly spansByTrace = new Map<string, Span[]>();
  private readonly audit: TraceAuditEntry[] = [];
  private spanSeq = 0;
  private traceSeq = 0;

  public constructor(cfg: TracerConfig) {
    this.grade = cfg.grade;
    this.allowBodySampling = cfg.allowBodySampling ?? false;
  }

  public startTrace(): string {
    this.traceSeq += 1;
    const traceId = `trace-${Date.now()}-${this.traceSeq}`;
    this.spansByTrace.set(traceId, []);
    this.record('TRACE_START', { traceId });
    return traceId;
  }

  public startSpan(opts: {
    traceId: string;
    name: string;
    kind: SpanKind;
    attributes?: SpanAttributes;
    parentId?: string;
  }): string {
    const attrs = this.sanitizeAttrs(opts.attributes ?? {});
    this.spanSeq += 1;
    const id = `span-${this.spanSeq}`;
    const span: Span = {
      id,
      traceId: opts.traceId,
      parentId: opts.parentId ?? null,
      name: opts.name,
      kind: opts.kind,
      startTime: this.now(),
      attributes: attrs,
      status: 'unset',
    };
    this.spans.set(id, span);
    const list = this.spansByTrace.get(opts.traceId) ?? [];
    list.push(span);
    this.spansByTrace.set(opts.traceId, list);
    this.record('SPAN_START', { traceId: opts.traceId, spanId: id });
    return id;
  }

  public endSpan(
    spanId: string,
    opts: { status?: SpanStatus; error?: string; extraAttrs?: SpanAttributes } = {},
  ): void {
    const span = this.spans.get(spanId);
    if (!span) throw new Error('TRACE_SPAN_NOT_FOUND');
    span.endTime = this.now();
    span.status = opts.status ?? 'ok';
    if (opts.error) span.errorMessage = opts.error;
    if (opts.extraAttrs) {
      const merged = this.sanitizeAttrs(opts.extraAttrs);
      span.attributes = { ...span.attributes, ...merged };
    }
    this.record('SPAN_END', { traceId: span.traceId, spanId });
  }

  public analyze(traceId: string): TraceStats {
    const spans = this.spansByTrace.get(traceId) ?? [];
    if (spans.length === 0) throw new Error('TRACE_EMPTY');
    let total = 0;
    const breakdown: Partial<Record<SpanKind, number>> = {};
    let bottleneck: Span = spans[0]!;
    let bottleneckDur = 0;
    for (const s of spans) {
      const dur = (s.endTime ?? s.startTime) - s.startTime;
      total += dur;
      breakdown[s.kind] = (breakdown[s.kind] ?? 0) + dur;
      if (dur > bottleneckDur) {
        bottleneckDur = dur;
        bottleneck = s;
      }
    }
    this.record('TRACE_ANALYZE', { traceId });
    return {
      traceId,
      totalMs: total,
      spanCount: spans.length,
      bottleneck,
      breakdown,
    };
  }

  public export(traceId: string): {
    resourceSpans: Array<{
      scopeSpans: Array<{
        scope: { name: string; version: string };
        spans: Array<{
          traceId: string;
          spanId: string;
          parentSpanId: string | null;
          name: string;
          kind: SpanKind;
          startTimeUnixNano: string;
          endTimeUnixNano: string;
          status: SpanStatus;
          attributes: Array<{ key: string; value: string | number | boolean }>;
        }>;
      }>;
    }>;
  } {
    const spans = this.spansByTrace.get(traceId) ?? [];
    const otlpSpans = spans.map((s) => ({
      traceId: s.traceId,
      spanId: s.id,
      parentSpanId: s.parentId,
      name: s.name,
      kind: s.kind,
      startTimeUnixNano: `${s.startTime * 1_000_000}`,
      endTimeUnixNano: `${(s.endTime ?? s.startTime) * 1_000_000}`,
      status: s.status,
      attributes: Object.entries(s.attributes)
        .filter((entry): entry is [string, string | number | boolean] =>
          entry[1] !== undefined,
        )
        .map(([key, value]) => ({ key, value })),
    }));
    this.record('TRACE_EXPORT', { traceId });
    return {
      resourceSpans: [
        {
          scopeSpans: [
            {
              scope: { name: 'llm-tracer', version: '1.0' },
              spans: otlpSpans,
            },
          ],
        },
      ],
    };
  }

  public getSpans(traceId: string): Span[] {
    return [...(this.spansByTrace.get(traceId) ?? [])];
  }

  public getGrade(): DataGrade {
    return this.grade;
  }

  public getAuditLog(): TraceAuditEntry[] {
    return [...this.audit];
  }

  private sanitizeAttrs(attrs: SpanAttributes): SpanAttributes {
    const result: SpanAttributes = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (BODY_FORBIDDEN_KEYS.has(key)) {
        if (this.grade !== 'O' || !this.allowBodySampling) {
          this.record('GRADE_BLOCK', { reason: `body-key:${key}` });
          throw new Error('TRACE_GRADE_BLOCKED');
        }
        // O + 샘플링 허용 시 256자 trunc
        if (typeof value === 'string') {
          result[key] = value.slice(0, 256);
          continue;
        }
      }
      result[key] = value;
    }
    return result;
  }

  private now(): number {
    return Date.now();
  }

  private record(
    action: TraceAuditAction,
    extra: Partial<TraceAuditEntry> = {},
  ): void {
    this.audit.push({
      timestamp: new Date().toISOString(),
      action,
      ...extra,
    });
  }
}
