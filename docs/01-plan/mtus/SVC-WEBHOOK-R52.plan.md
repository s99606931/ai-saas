# SVC-WEBHOOK-R52 Plan — Webhook Dispatcher 공통 패키지

> **MTU ID**: SVC-WEBHOOK-R52
> **라운드**: R52 (3회차 고도화 루프 #3)
> **작성일**: 2026-04-11
> **작성자**: PM Lead
> **상태**: Plan 완료

---

## Executive Summary

| 관점 | 핵심 내용 |
|------|---------|
| 비즈니스 | 공공기관 SaaS에서 타 시스템(연계 기관, 감사 시스템)에 이벤트 통지를 위한 Webhook 표준 |
| 기술 | HMAC-SHA256 서명 + timestamp 기반 replay 방지 + 지수 백오프 재시도 (빌드 인 backoff 라이브러리 활용 X, 내장) |
| 보안 | 비밀키 관리, 재생 공격 방지(timestamp tolerance), 응답 상태 기반 재시도 분류 |
| 감리 | 모든 발송 시도 결과(성공/실패/재시도)가 감사 가능한 결과 객체로 반환 |

---

## Context Anchor

- **WHY**: 여러 서비스(billing, subscription, audit)에서 중복 구현 중이던 Webhook 발송 로직을 단일 패키지로 통합
- **WHO**: 내부 서비스 개발자, 감리 대응 담당자, 외부 시스템 연동자
- **RISK**:
  - 비밀키 노출 → 환경변수/config-vault 사용 강제
  - 무한 재시도 → maxAttempts 강제
  - 대량 발송 시 병목 → 비동기 큐 인터페이스 고려(이번 라운드는 동기 실행만)
- **SUCCESS**:
  - `signPayload()`, `verifySignature()`, `dispatchWebhook()` 3개 공개 API
  - 단위 테스트 25개 이상 통과
  - X-Signature, X-Signature-Timestamp 헤더 표준화
- **SCOPE**:
  - 패키지: `@public-saas/webhook-dispatcher`
  - 포함: 서명 생성/검증, 발송기(재시도 포함), 타임스탬프 허용 범위 검증
  - 제외: Fastify/Express 플러그인(차후), 발송 큐/DB 영속화(서비스 레벨), 인입(수신) 핸들러

---

## 요구사항 (FR)

| ID | 설명 | 우선순위 |
|----|------|--------|
| FR-WH.1 | `signPayload(body, secret, timestamp?)` — HMAC-SHA256 서명 생성 | P0 |
| FR-WH.2 | `verifySignature(body, signature, secret, timestamp, toleranceMs?)` — 검증 (타임 상수 비교) | P0 |
| FR-WH.3 | `dispatchWebhook(url, payload, options)` — HTTP POST 발송 (fetch 사용) | P0 |
| FR-WH.4 | 지수 백오프 재시도 (초기 1초, 최대 60초, 최대 5회) | P0 |
| FR-WH.5 | 재시도 분류: 5xx/네트워크 에러 → 재시도, 4xx(408/429 제외) → 중단 | P0 |
| FR-WH.6 | 발송 결과 객체: `{ success, attempts, lastStatus, lastError?, durationMs }` | P0 |
| FR-WH.7 | 타임스탬프 replay 허용 범위 기본 300초 (5분) | P0 |
| FR-WH.8 | 서명 헤더 이름: `X-Public-SaaS-Signature`, `X-Public-SaaS-Timestamp` | P1 |
| NFR-WH.1 | 서명 비교는 `crypto.timingSafeEqual` 사용 (타이밍 공격 방지) | P0 |
| NFR-WH.2 | 외부 HTTP 호출 시 기본 타임아웃 10초 | P0 |

---

## 추적성 매트릭스

| FR ID | 설계 섹션 | 구현 파일 | 테스트 파일 | CSAP |
|-------|---------|---------|----------|------|
| FR-WH.1 | §2.1 | `src/signature.ts` | `tests/signature.test.ts` | D-09 |
| FR-WH.2 | §2.2 | `src/signature.ts` | `tests/signature.test.ts` | D-09, D-12 |
| FR-WH.3 | §3.1 | `src/dispatcher.ts` | `tests/dispatcher.test.ts` | D-06 |
| FR-WH.4 | §3.2 | `src/dispatcher.ts` | `tests/dispatcher.test.ts` | D-14 |
| FR-WH.5 | §3.3 | `src/dispatcher.ts` | `tests/dispatcher.test.ts` | D-14 |
| FR-WH.6 | §3.4 | `src/types.ts` | `tests/dispatcher.test.ts` | D-06 |
| FR-WH.7 | §2.3 | `src/signature.ts` | `tests/signature.test.ts` | D-09 |
| FR-WH.8 | §2.4 | `src/index.ts` | `tests/index.test.ts` | D-06 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-11 | 최초 작성 | PM Lead |
