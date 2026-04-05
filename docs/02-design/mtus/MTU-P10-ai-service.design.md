# MTU-P10: AI 서비스 관리 -- Design 문서

> **문서 ID**: DESIGN-MTU-P10 | **버전**: 1.0.0 | **작성일**: 2026-04-05

## 아키텍처

```
API Gateway (/api/v1/ai) → ai-service (port 3009) [dataGradeMiddleware]
                                ↓
                            ┌────────────────────┐
                            │ grade-check.ts     │ C/S 차단 (N2SF N-05)
                            │ pii-masking.ts     │ O등급 PII 마스킹
                            └────────────────────┘
                                ↓
                            PostgreSQL (AiModel, AiUsage)
                                ↓
                            LM Studio / 외부 AI API (O등급만)
```

## API 설계

| Method | Path | FR | 설명 |
|--------|------|-----|------|
| GET | /ai/models | FR-P10.1 | AI 모델 목록 조회 |
| POST | /ai/models | FR-P10.1 | AI 모델 등록 |
| PUT | /ai/models/:id | FR-P10.1 | AI 모델 수정 |
| POST | /ai/chat | FR-P10.2 | AI 채팅 (등급 검증 + PII 마스킹) |
| GET | /ai/usage | FR-P10.4 | 사용량 조회 (테넌트별) |
| GET | /ai/cost | FR-P10.5 | 비용 조회 |

## N2SF N-05 데이터 등급 규칙 (절대 제약)

1. 요청 데이터 등급 확인 -> C/S등급 즉시 차단 (DataGradeViolationError)
2. O등급 데이터 -> PII 마스킹 (maskPII) -> AI API 전송
3. 모든 AI 호출 감사 로그 기록

## 데이터 모델

- `AiModel`: id, name, provider, endpoint, maxGrade, isActive, config
- `AiUsage`: id, modelId, tenantId, tokens, cost, grade

## 보안 매핑

| CSAP | 구현 |
|------|------|
| N-05 | validateDataGrade + maskPII (기존 구현) |
| D-06 | AI 호출 감사 로그 |
