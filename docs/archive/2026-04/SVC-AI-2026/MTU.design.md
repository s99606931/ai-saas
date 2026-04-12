# Design: 2026년 최신 AI 기술 통합 서비스

> MTU ID: SVC-AI-2026 | 작성일: 2026-04-10 | Plan Ref: SVC-AI-2026.plan.md

## 1. FR-AI26.1: RAG 엔진

### 아키텍처
```
[문서 수집] → [청킹(512토큰)] → [임베딩(nomic/qwen)] → [벡터 저장(JSON)]
                                                              ↓
[질문] → [임베딩] → [코사인 유사도 검색] → [Top-K 청크] → [Gemma4 생성] → [출처 포함 응답]
```

### 데이터 모델
```
KnowledgeDocument: 원본 문서 (tenantId, title, content, source)
KnowledgeChunk:    청크 (documentId, chunkIndex, content, embeddingJson, tokenCount)
```

### 청킹 전략
- 크기: 512 토큰 (한국어 기준 약 256자)
- 오버랩: 50 토큰 (문맥 연속성)
- 구분자: 단락 → 문장 → 문자 순서

### 검색 알고리즘
- 1차: 코사인 유사도 시맨틱 검색 (Top-10)
- 2차: 키워드 가중치 보정 (BM25 근사)
- 최종: Top-5 청크를 LLM에 주입

### 생성 프롬프트 템플릿
```
[시스템] 당신은 공공기관 문서 전문가입니다. 제공된 문서에서만 답변하세요.
         문서에 없는 내용은 "제공된 문서에서 찾을 수 없습니다"라고 답하세요.

[컨텍스트]
{청크1} [출처: 문서명, p.N]
{청크2} [출처: 문서명, p.N]
...

[질문] {사용자 질문}
```

## 2. FR-AI26.2: AI 에이전트 (ReAct)

### ReAct 패턴
```
Thought: 현재 상황 분석
Action: tool_name({"param": "value"})
Observation: 도구 실행 결과
Thought: 결과 분석 + 다음 단계 결정
...
Answer: 최종 답변
```

### 내장 도구 (Built-in Tools)
| 도구 | 설명 | 입력 |
|------|------|------|
| search_knowledge | RAG 검색 | {query, tenantId} |
| summarize_document | 문서 요약 | {text, style} |
| classify_request | 민원 분류 | {text} |
| extract_entities | 개체명 추출 | {text} |
| calculate | 수학 계산 | {expression} |
| current_date | 현재 날짜/시간 | {} |

### 실행 제한 (안전장치)
- 최대 반복: 10회
- 타임아웃: 120초
- 토큰 예산: 32768 토큰/세션

## 3. FR-AI26.3: Structured Outputs

### 민원 분류 스키마
```json
{
  "category": "교통|복지|세금|민원|기타",
  "subCategory": "string",
  "priority": "긴급|높음|보통|낮음",
  "department": "string",
  "summary": "string (50자 이내)",
  "keywords": ["string"],
  "requiresHuman": boolean,
  "estimatedDays": number
}
```

### 문서 분석 스키마
```json
{
  "title": "string",
  "summary": "string (3문장)",
  "keyPoints": ["string"],
  "riskLevel": "높음|보통|낮음",
  "riskItems": ["string"],
  "actionRequired": boolean,
  "deadline": "string | null"
}
```

## 4. FR-AI26.4: 문서 AI (Long-Context)

### 처리 흐름
```
텍스트 입력 (최대 100,000자)
    → PII 마스킹
    → Gemma4 128k 컨텍스트로 전체 분석
    → 구조화 출력 반환
```

### 분석 유형
- `summary`: 3줄 요약
- `extract`: 핵심 정보 추출 (날짜, 금액, 이름, 조항)
- `risk`: 위험 조항/문구 탐지
- `compare`: 두 문서 비교

## 5. FR-AI26.5: AI Workflow

### 사전 정의 워크플로우
| ID | 이름 | 단계 |
|----|------|------|
| WF-001 | 민원 자동 처리 | 접수→분류→담당자배정→초안생성 |
| WF-002 | 공문서 검토 | 업로드→분석→위험탐지→보고서 |
| WF-003 | 회의록 처리 | 텍스트입력→요약→액션아이템→배포 |

## 파일 변경 목록

| 작업 | 파일 | FR |
|------|------|----|
| 신규 | src/lib/rag-engine.ts | FR-AI26.1 |
| 신규 | src/lib/chunker.ts | FR-AI26.1 |
| 신규 | src/lib/vector-store.ts | FR-AI26.1 |
| 신규 | src/lib/ai-agent.ts | FR-AI26.2 |
| 신규 | src/lib/ai-tools.ts | FR-AI26.2 |
| 신규 | src/lib/structured-output.ts | FR-AI26.3 |
| 신규 | src/handlers/ai-rag.handler.ts | FR-AI26.1 |
| 신규 | src/handlers/ai-agent.handler.ts | FR-AI26.2 |
| 신규 | src/handlers/ai-structured.handler.ts | FR-AI26.3 |
| 신규 | src/handlers/ai-document.handler.ts | FR-AI26.4 |
| 신규 | src/handlers/ai-workflow.handler.ts | FR-AI26.5 |
| 수정 | src/routes.ts | 신규 라우트 |
| 신규 | tests/unit/rag-engine.test.ts | FR-AI26.1 |
| 신규 | tests/unit/ai-agent.test.ts | FR-AI26.2 |
| 신규 | tests/unit/structured-output.test.ts | FR-AI26.3 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 | PM |
