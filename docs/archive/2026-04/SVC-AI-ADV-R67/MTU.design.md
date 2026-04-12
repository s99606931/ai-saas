# SVC-AI-ADV-R67 — 설계

## 모듈
- `llm-distributed-trace.ts`
  - `LLMTracer` 클래스: startSpan/endSpan/currentSpan/export/analyze

## 핵심 타입
```typescript
type SpanKind = 'llm' | 'retriever' | 'rerank' | 'tool' | 'embed' | 'custom';
type DataGrade = 'C' | 'S' | 'O';

interface SpanAttributes {
  'llm.model'?: string;
  'llm.prompt.tokens'?: number;
  'llm.completion.tokens'?: number;
  'llm.temperature'?: number;
  'retriever.k'?: number;
  'tool.name'?: string;
  [key: string]: string | number | boolean | undefined;
}

interface Span {
  id: string;
  traceId: string;
  parentId: string | null;
  name: string;
  kind: SpanKind;
  startTime: number;   // monotonic ms
  endTime?: number;
  attributes: SpanAttributes;
  status: 'ok' | 'error' | 'unset';
  errorMessage?: string;
}

interface TraceStats {
  traceId: string;
  totalMs: number;
  spanCount: number;
  bottleneck: Span;            // 가장 긴 span
  breakdown: Record<SpanKind, number>; // kind별 누적 ms
}
```

## 흐름
```
startTrace({grade}) → traceId
→ startSpan({name, kind, attrs, parentId?}) → spanId
  → endSpan(spanId, {status, error?})
→ analyze(traceId) → TraceStats
→ export(traceId) → OpenTelemetry 호환 JSON
```

## 보안 설계 (N2SF N-05)
- Tracer 생성 시 `grade` 설정 필수
- C/S 등급: attribute 중 `llm.prompt.body`, `llm.completion.body` 값이 있으면 즉시 에러 (`TRACE_GRADE_BLOCKED`)
- O 등급: 본문 첫 256자만 저장 허용 (샘플링 플래그 기본 off)

## 병목 분석
- `analyze()` — 완료된 span 중 duration 최대값 → bottleneck
- kind별 누적 시간 합 → breakdown

## Export 포맷 (OpenTelemetry 호환)
```json
{
  "resourceSpans": [{
    "scopeSpans": [{
      "scope": { "name": "llm-tracer", "version": "1.0" },
      "spans": [
        { "traceId": "...", "spanId": "...", "name": "...",
          "startTimeUnixNano": "...", "endTimeUnixNano": "...",
          "attributes": [...] }
      ]
    }]
  }]
}
```

## 감사 로그
- TRACE_START / SPAN_START / SPAN_END / TRACE_EXPORT / GRADE_BLOCK
- `getAuditLog()` 제공
