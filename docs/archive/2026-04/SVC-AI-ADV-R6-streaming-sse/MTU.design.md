# SVC-AI-ADV-R6: AI Streaming & SSE — Design

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-AI-ADV-R6.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Design Anchor

### 아키텍처 옵션 분석

| 옵션 | 장점 | 단점 | 적합도 |
|------|------|------|--------|
| A: WebSocket 양방향 | 양방향 통신, 저지연 | 복잡한 연결 관리, 프록시 호환 문제, 과도 설계 | 낮음 |
| B: SSE + ReadableStream (선택) | 표준 HTTP, 프록시 친화, 자동 재연결, 단순 | 서버→클라이언트 단방향 | **높음** |
| C: Long Polling | 가장 넓은 호환성 | 높은 지연, 비효율적 리소스 사용 | 낮음 |

**선택: 옵션 B — SSE + ReadableStream (Pragmatic Balance)**
- LLM 스트리밍은 서버→클라이언트 단방향이므로 SSE가 최적
- OpenAI/Anthropic/Ollama 모두 SSE 표준 사용
- Web API ReadableStream으로 백프레셔 자연 지원

---

## §1 SSE 스트리밍 코어 (ai-streaming.ts)

### 1.1 SSE 이벤트 프로토콜

```
event: token
data: {"delta":"안녕","index":0}

event: token
data: {"delta":"하세요","index":1}

event: usage
data: {"promptTokens":50,"completionTokens":120,"totalTokens":170}

event: done
data: {"finishReason":"stop","totalTokens":170}

event: error
data: {"code":"PROVIDER_ERROR","message":"모델 응답 오류"}

event: ping
data: {}
```

### 1.2 SSE 이벤트 타입 정의

```typescript
interface SSETokenEvent {
  delta: string;
  index: number;
}

interface SSEUsageEvent {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface SSEDoneEvent {
  finishReason: 'stop' | 'length' | 'cancelled';
  totalTokens: number;
}

interface SSEErrorEvent {
  code: string;
  message: string;
}
```

### 1.3 ReadableStream 생성 패턴

```typescript
function createSSEStream(options: StreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  
  return new ReadableStream({
    async start(controller) {
      // LLM 프로바이더 스트림 시작
      // heartbeat 타이머 시작
    },
    async pull(controller) {
      // 백프레셔: 컨슈머가 준비될 때만 다음 청크 전송
    },
    cancel(reason) {
      // 클라이언트 취소 시 정리
      // LLM 스트림 중단
      // heartbeat 타이머 정리
    }
  });
}
```

---

## §2 취소 처리 (FR-ADV6.3)

### 2.1 AbortSignal 연동

```
클라이언트 AbortController.abort()
  → Request.signal.aborted = true
  → ReadableStream.cancel() 트리거
  → LLM 프로바이더 스트림 중단
  → 리소스 정리 (타이머, 버퍼, 카운터)
  → 감사 로그 기록 (cancelled)
```

### 2.2 정리 보장 패턴

- AbortSignal 리스너 등록
- try-finally 블록에서 리소스 해제
- 취소 후 100ms 내 모든 리소스 해제 (NFR-R6.4)

---

## §3 백프레셔 제어 (FR-ADV6.4)

### 3.1 ReadableStream pull 메커니즘

- ReadableStream의 `pull()` 콜백은 내부 큐의 high water mark 이하일 때만 호출
- `highWaterMark`: 16KB (기본) — 토큰 이벤트 약 200개 버퍼
- 클라이언트가 느리면 자동으로 서버 전송 일시정지
- LLM 프로바이더에서 버퍼링 (프로바이더의 자체 버퍼 활용)

### 3.2 메모리 보호

- 세션당 최대 버퍼: 2MB (NFR-R6.3)
- 초과 시 스트림 강제 종료 + error 이벤트 전송

---

## §4 에러 처리 (FR-ADV6.5)

### 4.1 에러 유형별 처리

| 에러 유형 | SSE 이벤트 | 후속 처리 |
|----------|-----------|----------|
| LLM 프로바이더 오류 | error + code:PROVIDER_ERROR | 스트림 종료, 재시도 안내 |
| 토큰 한도 초과 | error + code:TOKEN_LIMIT | 스트림 종료, 현재까지 응답 보존 |
| 타임아웃 | error + code:TIMEOUT | 스트림 종료 |
| 내부 서버 오류 | error + code:INTERNAL_ERROR | 스트림 종료, 에러 ID 반환 |

### 4.2 부분 응답 보존

- 에러 발생 전까지의 토큰은 클라이언트에 이미 전달됨
- done 이벤트 대신 error 이벤트로 종료 표시
- 클라이언트가 부분 응답 활용 여부 결정

---

## §5 토큰 사용량 집계 (FR-ADV6.6)

### 5.1 실시간 카운팅

```typescript
interface TokenCounter {
  promptTokens: number;      // 프롬프트 토큰 (시작 시 설정)
  completionTokens: number;  // 생성 토큰 (스트리밍 중 증가)
  startTime: number;         // 시작 시각 (ms)
}
```

- 각 토큰 이벤트마다 completionTokens 증가
- 스트림 완료 시 usage 이벤트 전송
- usage-limit.ts와 연동하여 한도 초과 시 조기 종료

---

## §6 Heartbeat (FR-ADV6.7)

- 30초 간격 ping 이벤트 전송
- 프록시/로드밸런서의 유휴 타임아웃 방지
- 클라이언트에서 heartbeat 미수신 시 재연결 트리거

---

## §7 인증 게이트 (FR-ADV6.8)

- 스트림 생성 전 JWT 토큰 검증 (CSAP D-08)
- 인증 실패 시 SSE 스트림 대신 401 JSON 응답
- 인가(권한) 부족 시 403 JSON 응답
- 스트림 시작 후에는 토큰 만료로 중단하지 않음 (이미 인증됨)

---

## Session Guide

### 구현 순서

1. ai-streaming.ts: SSE 이벤트 타입 + createSSEStream() + 백프레셔 + heartbeat
2. streaming-handler.ts: 요청 파싱 + 인증 게이트 + 스트림 응답 생성 + 감사 로그

### 주요 의존성

- llm-provider.ts: LLMStreamChunk 인터페이스 (이미 존재)
- usage-limit.ts: 사용량 한도 확인
- audit.ts: 감사 로그 기록
- pii-masking.ts: 스트리밍 중 PII 마스킹
