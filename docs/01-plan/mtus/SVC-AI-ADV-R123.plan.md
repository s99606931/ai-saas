# SVC-AI-ADV-R123 — AI Token Budget Manager

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R123

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 테넌트별 토큰 쿼터 + 롤링 한도(분/시/일/월) + 소비 집계 + 초과 차단 |
| 품질 | 모델별 가중치(input/output) 반영, 잔여율 계산, 경고 임계값 알림 |
| 보안 | tenantId 격리, C/S 등급 사용자 프롬프트 집계 금지, 감사 로그 |
| 비용 | 순수 메모리 카운터, 외부 의존성 없음 |

## Context Anchor

- **WHY**: 공공기관 SaaS에서 AI 사용량 급증 시 월 예산 초과 방지. 테넌트별 토큰 쿼터 강제 필요.
- **WHO**: 플랫폼 운영팀, 비용 관리자, 각 테넌트 책임자
- **RISK**: 미집계 시 예산 초과 → 롤링 윈도우 기반 강제 차단
- **SUCCESS**: 테넌트 등록 → 소비 기록 → 한도 초과 시 `QuotaExceededError` + 잔여량 조회
- **SCOPE**: In — 쿼터/집계/차단. Out — 실제 LLM 호출(외부 모듈)

## 요구사항

- **FR-R123.1**: 테넌트 예산 등록 (tenantId, limits: { minute, hour, day, month })
- **FR-R123.2**: 토큰 소비 기록 (model, inputTokens, outputTokens, timestamp)
- **FR-R123.3**: 롤링 윈도우 합계 계산 (현재시각 기준 분/시/일/월)
- **FR-R123.4**: 한도 초과 시 `QuotaExceededError` throw + 어떤 창이 초과되었는지 상세 리턴
- **FR-R123.5**: 모델별 입출력 가중치 설정(cost multiplier) 지원
- **FR-R123.6**: 경고 임계값(기본 80%) 초과 시 warning 이벤트 리스너 호출
- **FR-R123.7**: 잔여량 조회 `getRemaining(tenantId)` — 창별 남은 토큰
- **FR-R123.8**: N2SF C/S 등급 guard (consume.grade 파라미터)
- **FR-R123.9**: `getAuditLog()` 감사 로그
- **NFR-R123.1**: TypeScript strict 0, 테스트 80%+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R123.1~7 | ai-token-budget-manager.ts | .test.ts | D-06 |
| FR-R123.8 | grade guard | test | N2SF N-05 |
| FR-R123.9 | auditLog | test | D-06 |
