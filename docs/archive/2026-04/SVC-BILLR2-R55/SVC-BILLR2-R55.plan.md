# SVC-BILLR2-R55 Plan — Billing Service R2 표준화

> **MTU ID**: SVC-BILLR2-R55
> **라운드**: R55 (3회차 고도화 루프 #6)
> **작성일**: 2026-04-11
> **작성자**: PM Lead
> **상태**: Plan 완료

---

## Executive Summary

| 관점 | 핵심 내용 |
|------|---------|
| 비즈니스 | 결제/인보이스 오류 응답 표준화 → 대외 연동 기관 일관성 확보 |
| 기술 | `@public-saas/problem-details` 마이그레이션 + traceId 주입 |
| 보안 | D-06 감사 로그 user-agent/ip 입력 sanitize |
| 감리 | RFC 7807 표준 응답 — 감리 산출물 품질 향상 |

---

## Context Anchor

- **WHY**: billing 핸들러 9개 에러 응답이 `{success:false, error:{code,message}}` 비표준 스키마. auth/api-gateway 와 불일치
- **WHO**: 재무부 정산 시스템, 전자세금계산서 연동, API 소비자
- **RISK**: 에러 스키마 변경이 클라이언트 파싱에 영향 → 추가 필드 전환만, 기존 필드 유지 불가 (새 응답은 RFC 7807)
- **SUCCESS**: 9개 에러 지점 Problem Details 전환, audit 입력 sanitize, 테스트 회귀 없음
- **SCOPE**:
  - 포함: billing.handler.ts 전체, audit.ts sanitize, problem-reply 헬퍼
  - 제외: billing-stats.handler.ts (변경 최소화), DB 스키마

---

## 요구사항 (FR)

| ID | 설명 | 우선순위 |
|----|------|--------|
| FR-BILLR2.1 | `problemReply()` 헬퍼 생성 (auth R2와 동형) | P0 |
| FR-BILLR2.2 | billing.handler 9개 에러 응답을 Problem Details 로 전환 | P0 |
| FR-BILLR2.3 | traceId (`x-request-id`/`traceparent`) 추출 및 주입 | P0 |
| FR-BILLR2.4 | audit.ts `user-agent`/`ip` sanitize (제어문자 제거 + 길이 제한) | P0 |
| FR-BILLR2.5 | problem type 네임스페이스 `https://problems.public-saas.kr/errors/billing/*` | P0 |
| FR-BILLR2.6 | 신규 단위 테스트 12+ (problem-reply + audit sanitize) | P0 |
| NFR-BILLR2.1 | 기존 158+ 테스트 회귀 0 | P0 |
| NFR-BILLR2.2 | 응답 Content-Type: `application/problem+json; charset=utf-8` | P0 |

---

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
