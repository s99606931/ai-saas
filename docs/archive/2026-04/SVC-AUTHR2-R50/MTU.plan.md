# SVC-AUTHR2-R50 Plan — Auth Service R2 (Problem Details + Input Sanitizer 통합)

> **MTU ID**: SVC-AUTHR2-R50
> **라운드**: R50 (3회차 고도화 루프 #1)
> **작성일**: 2026-04-11
> **작성자**: PM Lead
> **상태**: Plan 완료

---

## Executive Summary (4-Perspective)

| 관점 | 핵심 내용 |
|------|---------|
| 비즈니스 | 인증 API 에러 응답을 RFC 7807 표준으로 전환하여 연계 시스템(감사·포털·SDK) 파싱 일관성 확보 |
| 기술 | `@public-saas/problem-details` + `@public-saas/input-sanitizer` + `@public-saas/trace-context` 통합. 기존 핸들러 비침습 패치 |
| 보안 | CSAP D-06 감사 로그 상관관계 강화(traceId), D-12 입력 검증 보강(제어문자 제거, UA 길이 제한) |
| 감리 | 에러 응답 표준화로 감리 로그 분석 자동화 가능. 감사 로그 필드 일관성 증가 |

---

## Context Anchor

- **WHY**: 기존 에러 응답 `{success:false, error:{code,message}}`는 RFC 7807 미준수. 멀티 서비스 통합 시 파싱 규약 불일치로 감리 추적성이 약화됨.
- **WHO**: 인증 API 호출자(프론트엔드, SDK, 감사 수집기, 포털), 감리 대응 담당자
- **RISK**: 기존 클라이언트 호환성 파괴 가능. 대응: `application/problem+json` Content-Type만 반환. 기존 success 응답 포맷은 유지.
- **SUCCESS**: 인증 API 4xx/5xx 응답 100%가 Problem Details로 전환. traceId 헤더·본문 일치. 단위 테스트 15개 이상 통과.
- **SCOPE**:
  - 대상 핸들러: `login.handler.ts`, `refresh.handler.ts`, `logout.handler.ts`, `verify.handler.ts`
  - 대상 라이브러리: `session.ts` 감사 로그 위생화
  - 범위 제외: 응답 본문 success 케이스, MFA/패스워드 변경 핸들러(다음 라운드)

---

## 요구사항 (FR)

| ID | 설명 | 우선순위 |
|----|------|--------|
| FR-AUTHR2.1 | 모든 4xx/5xx 응답을 `application/problem+json` + RFC 7807 Problem Details 본문으로 전환 | P0 |
| FR-AUTHR2.2 | 응답 본문에 `traceId` 필드 포함. `trace-context.getCurrentTraceId()` 또는 `x-request-id` 헤더에서 추출 | P0 |
| FR-AUTHR2.3 | 입력 이메일에 `stripControlChars()` 적용 후 `trim().toLowerCase()`로 정규화 | P0 |
| FR-AUTHR2.4 | `User-Agent`/IP 감사 로그 기록 전 `stripControlChars()` + `truncate(500)` 적용 | P0 |
| FR-AUTHR2.5 | Problem Details `instance` 필드에 요청 경로(`request.routerPath`)를 포함 | P1 |
| FR-AUTHR2.6 | `login` 423(잠금), 401(자격증명), 403(MFA) 각 케이스에 전용 `type` URI 지정 | P1 |
| NFR-AUTHR2.1 | 기존 success(200) 응답 포맷은 유지(하위 호환) | P0 |
| NFR-AUTHR2.2 | 핸들러 성능 저하 1ms 미만 (validator 추가 비용) | P1 |

---

## 추적성 매트릭스

| FR ID | 설계 섹션 | 구현 파일 | 테스트 파일 | CSAP |
|-------|---------|---------|----------|------|
| FR-AUTHR2.1 | §2.1 Problem Wrapper | `lib/problem-reply.ts`, `handlers/*.ts` | `tests/unit/problem-reply.test.ts` | D-12-03 |
| FR-AUTHR2.2 | §2.2 TraceId 주입 | `lib/problem-reply.ts` | `tests/unit/problem-reply.test.ts` | D-06-02 |
| FR-AUTHR2.3 | §3.1 Email 정규화 | `handlers/login.handler.ts` | `tests/unit/login-sanitize.test.ts` | D-12-01 |
| FR-AUTHR2.4 | §3.2 UA 위생화 | `lib/audit.ts` | `tests/unit/audit-sanitize.test.ts` | D-06-01 |
| FR-AUTHR2.5 | §2.1 | `lib/problem-reply.ts` | `tests/unit/problem-reply.test.ts` | D-06-02 |
| FR-AUTHR2.6 | §2.3 에러 타입 | `handlers/login.handler.ts` | `tests/unit/login-errors.test.ts` | D-08-06 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-11 | 최초 작성 | PM Lead |
