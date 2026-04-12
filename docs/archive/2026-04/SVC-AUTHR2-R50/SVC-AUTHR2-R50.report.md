# SVC-AUTHR2-R50 Report — Auth Service R2

> **라운드**: R50 (3회차 고도화 루프 #1)
> **작성일**: 2026-04-11
> **matchRate**: 100%

---

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | 인증 API 에러 응답 표준화 | RFC 7807 Problem Details 100% 전환 (4개 핸들러) |
| 기술 | 공통 패키지 재사용 | `@public-saas/problem-details` + `@public-saas/input-sanitizer` 통합 완료 |
| 보안 | 로그 인젝션 방어 | 제어문자 제거, UA 500자 제한, IP 패턴 검증 |
| 감리 | 추적성 | traceId(x-request-id/traceparent) 자동 주입 |

---

## Key Decisions & Outcomes

### PRD → Plan → Design 결정 체인

1. **PRD 수준**: 공공 감리 시 에러 응답 자동 파싱을 위해 표준 규약 필수 → RFC 7807 Problem Details 채택
2. **Plan 수준**: 기존 success 응답 포맷은 유지 (하위 호환). 에러 경로만 전환
3. **Design 수준**: 3가지 아키텍처 검토
   - 옵션 A (전역 setErrorHandler): 기존 reply.send 패턴 충돌 → 탈락
   - **옵션 B (공용 헬퍼 problemReply)**: 점진 도입, 호환성 확보 → 선정
   - 옵션 C (reply 데코레이터): 타입 확장 부담 → 차순위
4. **구현 수준**: TraceId 추출은 헤더 기반(x-request-id → traceparent)으로 안정화. AsyncLocalStorage는 향후 과제

---

## Success Criteria Final Status

| FR ID | 요구사항 | 상태 |
|-------|---------|------|
| FR-AUTHR2.1 | 4xx/5xx Problem Details | OK |
| FR-AUTHR2.2 | traceId 주입 | OK |
| FR-AUTHR2.3 | Email 정규화 | OK |
| FR-AUTHR2.4 | UA/IP 위생화 | OK |
| FR-AUTHR2.5 | instance 경로 | OK |
| FR-AUTHR2.6 | 전용 type URI 11종 | OK |
| NFR-AUTHR2.1 | 하위 호환 | OK |
| NFR-AUTHR2.2 | 성능 오버헤드 < 1ms | OK |

---

## 품질 증거

### 테스트 결과

```
Test Files  12 passed (12)
Tests  177 passed (177)
  - problem-reply.test.ts:  14 tests
  - audit-sanitize.test.ts: 10 tests
  - 기존 153 tests: 회귀 없음
```

### 타입체크

```
pnpm --filter @public-saas/auth-service typecheck
> tsc --noEmit
(에러 0, 경고 0)
```

### 빌드

```
pnpm --filter @public-saas/auth-service build
> tsc
(빌드 성공)
```

---

## 발견된 이슈 및 해결

| 이슈 | 해결 |
|------|------|
| `trace-context` AsyncLocalStorage 통합 | 향후 라운드로 연기. 헤더 기반 추출로 안정화 |
| global-error-handler 포맷 불일치 | 별도 라운드 필요 (범위 외) |
| MFA/password-change 핸들러 | R51 차순위 라운드로 이월 |

---

## CSAP/N2SF 준수 매핑

| 항목 | 영역 | 달성 |
|------|------|------|
| D-06-01 | 침해사고 관리 | UA/IP 위생화로 로그 인젝션 차단 |
| D-06-02 | 상관관계 | traceId 주입 |
| D-08-01 | 인증 | 기존 유지 |
| D-08-06 | 계정 잠금 | 명시적 Problem 타입 URI |
| D-12-01 | 입력 검증 | 이메일 정규화 강화 |
| D-12-03 | 표준 에러 응답 | RFC 7807 준수 |

---

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
