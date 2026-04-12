# SVC-AI-ADV-R9: AI Observability — Design

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-AI-ADV-R9.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Design Anchor

**선택: 자체 구현 — 경량 인메모리 + Prometheus 호환 노출**
- 외부 APM 서비스 금지 (CLAUDE.md §1)
- OpenTelemetry SDK 최소 의존

---

## §1 LLM 메트릭 수집기 (llm-metrics.ts)

### 1.1 수집 메트릭

| 메트릭 | 타입 | 설명 |
|--------|------|------|
| llm_request_duration_ms | Histogram | 전체 요청 레이턴시 |
| llm_ttft_ms | Histogram | Time To First Token |
| llm_tokens_total | Counter | 토큰 사용량 (prompt/completion 구분) |
| llm_request_total | Counter | 요청 수 (모델별, 상태별) |
| llm_error_total | Counter | 에러 수 (에러 유형별) |
| llm_cache_hit_total | Counter | 캐시 히트 수 |
| llm_active_streams | Gauge | 활성 스트리밍 세션 수 |

### 1.2 차원 (Labels)

- model: 모델 ID
- tenant: 테넌트 ID
- status: success / error
- method: chat / stream / embed
- error_type: timeout / provider / validation

### 1.3 Prometheus 텍스트 형식 노출

```
# HELP llm_request_duration_ms LLM 요청 레이턴시
# TYPE llm_request_duration_ms histogram
llm_request_duration_ms_bucket{model="sonnet",le="100"} 15
llm_request_duration_ms_bucket{model="sonnet",le="500"} 42
...
```

---

## §2 프롬프트 버전 관리 (prompt-versioning.ts)

### 2.1 프롬프트 버전 구조

```typescript
interface PromptVersion {
  id: string;           // UUID
  name: string;         // 프롬프트 이름
  version: number;      // 시맨틱 버전 (1, 2, 3...)
  template: string;     // 프롬프트 텍스트 (변수 {{variable}} 포함)
  variables: string[];  // 필요한 변수 목록
  metadata: Record<string, unknown>;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  activatedAt?: string;
}
```

### 2.2 A/B 테스트

```typescript
interface ABTest {
  id: string;
  name: string;
  variants: Array<{
    promptVersionId: string;
    weight: number;  // 0.0 ~ 1.0
  }>;
  status: 'running' | 'completed';
  metrics: Record<string, number>;
}
```

---

## §3 RAG 평가기 (rag-evaluator.ts)

### 3.1 RAGAS 메트릭

| 메트릭 | 설명 | 계산 방법 |
|--------|------|----------|
| Faithfulness | 응답이 컨텍스트에 근거하는 정도 | LLM 판단: 응답의 각 주장이 컨텍스트에서 지지되는지 |
| Answer Relevancy | 응답이 질문에 적절한 정도 | LLM 판단: 응답에서 역질문 생성 → 원 질문과 유사도 |
| Context Precision | 검색된 컨텍스트 중 실제 유용한 비율 | LLM 판단: 각 컨텍스트 청크의 유용성 |

### 3.2 평가 입력

```typescript
interface RAGEvaluationInput {
  question: string;     // 원본 질문
  answer: string;       // LLM 응답
  contexts: string[];   // 검색된 컨텍스트 청크들
  groundTruth?: string; // 정답 (선택, 있으면 정확도도 평가)
}
```

---

## Session Guide

1. llm-metrics.ts: 메트릭 타입 + 수집기 + 집계 + Prometheus 노출
2. prompt-versioning.ts: 버전 CRUD + A/B 테스트 + 변수 렌더링
3. rag-evaluator.ts: RAGAS 3종 메트릭 + LLM 기반 평가 + 이상 감지
