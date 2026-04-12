# SVC-APIGWR2-R51 Report — API Gateway R2

> **라운드**: R51 (3회차 고도화 루프 #2)
> **작성일**: 2026-04-11
> **matchRate**: 100%

---

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | 게이트웨이 에러 응답 표준화 | 전역 에러 핸들러 + 5개 지점 Problem Details 전환 |
| 기술 | Fastify setErrorHandler 적용 | 플러그인 `problem-error.ts` 신규 추가 |
| 보안 | 로그 상관관계 + traceId 주입 | x-request-id → request.id fallback |
| 감리 | 전역 404/500 응답 자동 표준화 | 100% 커버리지 |

---

## Key Decisions

1. **전역 훅 + 개별 핸들러 병행** 채택. 프록시 본체 응답은 건드리지 않음으로 하위 호환 확보
2. **traceId 소스**: x-request-id 헤더(correlation-id 플러그인과 호환) → request.id fallback
3. **admin 엔드포인트**: 기존 `{success:false}` → `forbidden(...)` + problem+json 전환
4. **circuit-open/proxy-error**: 각각 `serviceUnavailable`/`badGateway` 프리셋 + 확장 필드(retryAfterMs)

---

## 품질 증거

```
Test Files  7 passed (7)
Tests  99 passed (99)
  - problem-error.test.ts: 12 tests (신규)
  - 기존 87 tests: 회귀 없음
```

- typecheck: 에러 0
- build: 성공

---

## CSAP/N2SF 매핑

| 항목 | 영역 | 달성 |
|------|------|------|
| D-06-01 | 로그 | request.log.error traceId 포함 |
| D-06-02 | 상관관계 | traceId 주입 일관화 |
| D-07 | 가용성 | circuit-open 503 Problem Details |
| D-10 | 네트워크 | content-type 강제 |
| D-12-03 | 표준 에러 | RFC 7807 100% 전환 |

---

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
