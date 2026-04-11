# MTU-N256: 공공데이터 실시간 스트리밍 파이프라인 — 설계 문서

> **버전**: 1.0 | **작성일**: 2026-04-12 | **작성자**: PM Lead
> **Plan 참조**: MTU-N256-realtime-data-pipeline.plan.md

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 옵션 | **Option B: Pragmatic Balance** — EventEmitter 기반 인메모리 스트림 + 배치 윈도우 |
| 패턴 | Pipeline (Source → Transform → Sink), Observer, Circuit Breaker, Backpressure |
| 의존성 | pii-masking.ts, grade-check.ts, event-bus 패키지 |

---

## §1 스트림 프로세서 코어 (FR-N256.1)

```typescript
// 핵심 인터페이스
interface StreamConfig {
  pipelineId: string;
  tenantId: string;
  batchSize: number;        // 기본 100
  batchTimeoutMs: number;   // 기본 5000ms
  maxBufferSize: number;    // 백프레셔 임계값 (기본 10000)
  maxRetries: number;       // DLQ 전 재시도 (기본 3)
  retryDelayMs: number;     // 지수 백오프 기본값 (기본 1000)
}

interface StreamEvent<T = unknown> {
  id: string;
  timestamp: string;
  tenantId: string;
  source: string;
  data: T;
  metadata: Record<string, string>;
  grade: 'O';              // N2SF O등급만 허용
}
```

- EventEmitter 기반 비동기 이벤트 루프
- 배치 윈도우: 개수(batchSize) 또는 시간(batchTimeoutMs) 중 먼저 도달 시 플러시
- 백프레셔: 버퍼 크기 > maxBufferSize 시 소스 일시 정지 (pause/resume)

## §2 소스 커넥터 (FR-N256.2)

3종 커넥터:
1. **HttpPollingSource**: HTTP GET 폴링 (configurable interval)
2. **WebSocketSource**: WebSocket 실시간 수신
3. **FileWatchSource**: 파일 시스템 감시 (신규/변경 파일 읽기)

공통 인터페이스:
```typescript
interface SourceConnector {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): void;    // 백프레셔용
  resume(): void;
  on(event: 'data', handler: (event: StreamEvent) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
}
```

## §3 변환 파이프라인 (FR-N256.3)

함수 체이닝 패턴:
```typescript
type TransformFn<I = unknown, O = unknown> = (event: StreamEvent<I>) => StreamEvent<O> | null;
// null 반환 = 필터링(제거)

// 내장 변환기:
// - filterTransform(predicate): 조건 필터
// - mapTransform(mapper): 데이터 변환
// - aggregateTransform(windowMs, aggregator): 시간 윈도우 집계
// - piiMaskTransform(): PII 자동 마스킹 (N2SF 필수)
// - gradeCheckTransform(): O등급 검증
```

## §4 싱크 커넥터 (FR-N256.4)

3종 싱크:
1. **VectorStoreSink**: 벡터 DB 적재 (RAG 지식베이스 갱신)
2. **EventBusSink**: 내부 이벤트 버스 발행
3. **FileSink**: JSON/CSV 파일 출력

at-least-once: 싱크 성공 확인 후 ACK, 실패 시 DLQ

## §5 Dead Letter Queue (FR-N256.5)

- 인메모리 큐 (최대 10,000건)
- 지수 백오프: delay * 2^attempt (최대 30초)
- 최대 3회 재시도 후 영구 격리 + 감사 로그

## §6 메트릭 (FR-N256.6)

Prometheus 카운터/게이지/히스토그램:
- `stream_events_received_total`
- `stream_events_processed_total`
- `stream_events_failed_total`
- `stream_processing_duration_seconds`
- `stream_buffer_size`
- `stream_dlq_size`

## §7 테넌트 격리 (FR-N256.7)

- 파이프라인 생성 시 tenantId 필수 바인딩
- 모든 이벤트에 tenantId 포함, 싱크 시 검증
- 크로스 테넌트 접근 시 즉시 차단 + 감사 로그

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 초기 Design 작성 | PM Lead |
