# Design: ai-service 라운드 3 고도화

> MTU ID: SVC-AI-R3 | 작성일: 2026-04-10 | Plan Ref: SVC-AI-R3.plan.md

## 1. FR-AI-R3.1: SSE 스트리밍 응답

### 아키텍처
```
Client ←── SSE ──── ai-service ←── stream ──── LM Studio
         data: {"text":"..."}       POST /v1/chat/completions
         data: [DONE]               { "stream": true }
```

### 파일 변경
| 작업 | 파일 | 설명 |
|------|------|------|
| 신규 | src/handlers/ai-stream.handler.ts | SSE 스트리밍 핸들러 |
| 수정 | src/lib/llm-provider.ts | chatStream() 메서드 추가 |
| 수정 | src/lib/providers/openai-compatible.ts | 스트리밍 구현 |
| 수정 | src/lib/providers/ollama.ts | 스트리밍 구현 |
| 수정 | src/routes.ts | POST /ai/chat/stream 라우트 등록 |

### SSE 이벤트 형식
```
data: {"text":"안녕","tokens":1}
data: {"text":"하세요","tokens":2}
data: [DONE]
```

### 스트림 종료 처리
- 정상 완료: `data: [DONE]`
- 클라이언트 연결 끊김: AbortController로 upstream 취소
- 오류: `data: {"error":"메시지"}` 후 연결 종료

## 2. FR-AI-R3.2: 임베딩 API

### 지원 모델 (LM Studio)
| 모델 | 차원 | 용도 |
|------|------|------|
| text-embedding-qwen3-embedding-0.6b | 1536 | 한국어 특화 |
| text-embedding-nomic-embed-text-v1.5 | 768 | 다국어 범용 |

### API 설계
```
POST /ai/embed
{
  "modelId": "uuid",
  "tenantId": "tenant-001",
  "texts": ["텍스트1", "텍스트2"],
  "grade": "O"
}

응답:
{
  "success": true,
  "data": {
    "embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...]],
    "model": "text-embedding-qwen3-embedding-0.6b",
    "dimensions": 1536,
    "tokensUsed": 42
  }
}
```

### 파일 변경
| 작업 | 파일 |
|------|------|
| 신규 | src/handlers/ai-embed.handler.ts |
| 수정 | src/lib/llm-provider.ts (embed() 메서드) |
| 수정 | src/lib/providers/openai-compatible.ts (embed 구현) |
| 수정 | src/lib/providers/ollama.ts (embed 구현) |
| 수정 | src/routes.ts |

## 3. FR-AI-R3.3: 스마트 모델 라우팅

### AiModel.config 확장
```json
{
  "modelId": "google/gemma-4-26b-a4b",
  "modelType": "chat",      // chat | embed | multimodal
  "isThinking": true,       // Thinking 모델 여부
  "maxTokens": 4096,
  "temperature": 0.7
}
```

### 라우팅 로직
```
요청 유형 감지:
  - images 있음 → modelType: "multimodal"
  - /ai/embed 엔드포인트 → modelType: "embed"
  - 기본 → modelType: "chat"

모델 선택:
  1. DB에서 해당 modelId 조회
  2. modelType 불일치 시 → 동일 provider의 적합한 모델 자동 선택
  3. 없으면 → 환경 변수 기본 모델 사용
```

### 파일
| 작업 | 파일 |
|------|------|
| 신규 | src/lib/model-router.ts |

## 4. FR-AI-R3.4: LLM 제공자 헬스체크

### API
```
GET /ai/provider/health

응답:
{
  "success": true,
  "data": {
    "provider": "lmstudio",
    "baseUrl": "http://192.168.0.104:1234",
    "status": "healthy",
    "responseTimeMs": 45,
    "models": ["google/gemma-4-26b-a4b", "gemma-4-e4b-it"],
    "checkedAt": "2026-04-10T12:00:00Z"
  }
}
```

### 파일
| 작업 | 파일 |
|------|------|
| 신규 | src/handlers/ai-provider.handler.ts |
| 수정 | src/routes.ts |

## 5. FR-AI-R3.5: 응답 캐싱

### 캐시 키 설계
```
key = sha256(provider + model + systemPrompt + userMessage)
TTL = 300초 (5분)
저장: Redis SETEX
```

### CSAP 준수
- O등급 데이터만 캐싱 (C/S등급 캐싱 절대 금지)
- 캐시에서 응답 시 감사 로그에 `cacheHit: true` 기록
- PII 마스킹 후 저장

### 파일
| 작업 | 파일 |
|------|------|
| 신규 | src/lib/response-cache.ts |
| 수정 | src/handlers/ai.handler.ts (캐시 조회/저장 추가) |

## 파일 변경 전체 목록

| 작업 | 파일 | FR |
|------|------|----|
| 신규 | src/handlers/ai-stream.handler.ts | FR-AI-R3.1 |
| 신규 | src/handlers/ai-embed.handler.ts | FR-AI-R3.2 |
| 신규 | src/handlers/ai-provider.handler.ts | FR-AI-R3.4 |
| 신규 | src/lib/model-router.ts | FR-AI-R3.3 |
| 신규 | src/lib/response-cache.ts | FR-AI-R3.5 |
| 수정 | src/lib/llm-provider.ts | FR-AI-R3.1, R3.2 |
| 수정 | src/lib/providers/openai-compatible.ts | FR-AI-R3.1, R3.2 |
| 수정 | src/lib/providers/ollama.ts | FR-AI-R3.1, R3.2 |
| 수정 | src/handlers/ai.handler.ts | FR-AI-R3.5 |
| 수정 | src/routes.ts | 신규 라우트 등록 |
| 신규 | tests/integration/ai-stream.test.ts | FR-AI-R3.1 |
| 신규 | tests/unit/ai-embed.test.ts | FR-AI-R3.2 |
| 신규 | tests/unit/model-router.test.ts | FR-AI-R3.3 |
| 신규 | tests/unit/response-cache.test.ts | FR-AI-R3.5 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM |
