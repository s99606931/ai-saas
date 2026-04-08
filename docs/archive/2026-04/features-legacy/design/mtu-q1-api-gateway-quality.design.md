# MTU-Q1: API 게이트웨이 품질 보완 -- Design 문서

> **문서 ID**: DESIGN-MTU-Q1
> **참조 Plan**: PLAN-MTU-Q1
> **버전**: 1.0.0
> **작성일**: 2026-04-06
> **작성자**: PM Agent

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| **아키텍처** | Fastify 플러그인 패턴 (기존 구조 확장) |
| **감사 로그** | Fastify onRequest/onResponse 훅 기반 미들웨어 |
| **OpenAPI** | @fastify/swagger + @fastify/swagger-ui, /api/docs 경로 |
| **보안** | 감사 로그에 민감 정보(Authorization 헤더 값) 마스킹 |

---

## 1. FR-P04.7: 감사 로그 미들웨어

### 설계

```
요청 수신 -> onRequest 훅 (요청 메타 수집)
  -> 비즈니스 처리 (프록시)
  -> onResponse 훅 (응답 메타 수집 + audit-sdk 기록)
```

### 기록 항목

| 필드 | 내용 |
|------|------|
| action | `API_REQUEST` |
| actor | JWT에서 추출한 userId 또는 'anonymous' |
| target | 요청 URL 경로 |
| targetType | `api-request` |
| metadata.method | HTTP 메서드 |
| metadata.statusCode | 응답 상태 코드 |
| metadata.latencyMs | 처리 시간 |
| metadata.userAgent | User-Agent 헤더 |
| ip | 클라이언트 IP |

### 마스킹 규칙

- Authorization 헤더: `Bearer ***` 로 마스킹
- 요청 본문: 로깅하지 않음 (N2SF 데이터 등급 위반 방지)
- 쿠키: 로깅하지 않음

### 성능 고려

- 감사 로그 기록은 비동기 (fire-and-forget)
- /health, /ready 경로는 로깅 제외 (노이즈 방지)

---

## 2. FR-P04.10: OpenAPI 문서

### 설계

- @fastify/swagger: OpenAPI 3.0 스펙 자동 생성
- @fastify/swagger-ui: /api/docs 경로에서 Swagger UI 제공
- 프록시 라우트는 수동 스키마 정의 (라우트 목록 표시)

### 접근 제한

- 개발 환경: /api/docs 접근 허용
- 운영 환경: 환경 변수 ENABLE_SWAGGER=true 시에만 활성화

---

## Session Guide

1. audit-logger.ts 플러그인 생성
2. swagger.ts 플러그인 생성
3. index.ts에 두 플러그인 등록
4. Q-Gate 검증

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | Design 작성 | PM Agent |
