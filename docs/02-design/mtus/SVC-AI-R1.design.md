# Design: ai-service 라운드 1 고도화

> MTU ID: SVC-AI-R1 | 작성일: 2026-04-09

## 1. FR-AI.1: 프롬프트 인젝션 방어
- 신규: `src/lib/prompt-guard.ts`
- 패턴: "ignore previous", "system:", "you are now", "jailbreak" 등
- 심각도 점수 기반 차단 (임계값 초과 시 거부)

## 2. FR-AI.2: 응답 PII 필터링
- chatHandler에서 AI 응답에 maskPII 적용

## 3. FR-AI.3: 사용량 제한
- 신규: `src/lib/usage-limit.ts`
- Redis 기반 일일 토큰 카운터
- 환경 변수: `AI_DAILY_TOKEN_LIMIT` (기본 100000)

## 파일 변경 목록
| 작업 | 파일 | FR |
|------|------|-----|
| 신규 | src/lib/prompt-guard.ts | FR-AI.1 |
| 신규 | src/lib/usage-limit.ts | FR-AI.3 |
| 수정 | src/handlers/ai.handler.ts | FR-AI.1~3 |
| 신규 | tests/integration/ai-security.test.ts | FR-AI.4 |
