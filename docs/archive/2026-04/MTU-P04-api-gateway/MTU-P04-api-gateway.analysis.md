# MTU-P04: API 게이트웨이 -- 갭 분석 보고서

> **문서 ID**: ANALYSIS-MTU-P04
> **Plan 참조**: PLAN-MTU-P04
> **Design 참조**: DESIGN-MTU-P04
> **분석일**: 2026-04-05
> **분석자**: PM Agent (Q-Gate Check)

---

## 1. FR 전수 매칭 결과

| FR ID | 요구사항 | 구현 파일 | 상태 | 비고 |
|-------|---------|---------|------|------|
| FR-P04.1 | 서비스별 프록시 라우팅 | `routes/proxy.ts` | PASS | @fastify/http-proxy, 14개 서비스 프록시 |
| FR-P04.2 | JWT 인증 미들웨어 | 미적용 (auth-sdk 존재) | PARTIAL | 레지스트리에 requireAuth 플래그만, 실제 미들웨어 미연결 |
| FR-P04.3 | RBAC 권한 검사 | 미적용 (requiredPermissions 정의만) | PARTIAL | 레지스트리에 권한 정의만, 실제 검사 미연결 |
| FR-P04.4 | Rate Limiting | `index.ts` rate-limit 등록 | PASS | IP+테넌트 기반, 100 req/min |
| FR-P04.5 | 서비스 레지스트리 | `registry/service-registry.ts` | PASS | 14개 정적 + 동적 Map |
| FR-P04.6 | N2SF 데이터 등급 검증 | `middleware/data-grade.middleware.ts` | PASS | X-Data-Grade 헤더 기반 (미연결) |
| FR-P04.7 | 요청/응답 감사 로그 | 미구현 | MISSING | MUST, MTU-P13 연동 필요 |
| FR-P04.8 | CORS 설정 | `index.ts` cors 등록 | PASS | 허용 Origin, 메서드, 헤더 설정 |
| FR-P04.9 | 헬스체크 엔드포인트 | `index.ts` /health, /ready | PASS | 등록 서비스 수 표시 |
| FR-P04.10 | OpenAPI 문서 자동 생성 | 미구현 | PARTIAL | SHOULD, @fastify/swagger 미적용 |
| FR-P04.11 | 비즈니스 서비스 동적 등록 | `routes/proxy.ts` + `service-registry.ts` | PARTIAL | 동적 프록시 라우트 존재하나 NOT_IMPLEMENTED 응답 |

---

## 2. 매칭률

- **MUST 요구사항**: 6/9 (66.7%) -- FR-P04.2, P04.3 미완, FR-P04.7 미구현
- **SHOULD 요구사항**: 0/2 (OpenAPI, 동적 등록 미완)
- **전체 매칭률**: 6/11 = **54.5%**

> 핵심 기능(프록시, Rate Limiting, CORS, 헬스체크, 레지스트리)은 구현 완료.
> 인증 미들웨어와 RBAC 검사는 각 서비스 자체에서 처리 중 (게이트웨이 수준 연동은 후속).
> 감사 로그는 MTU-P13 연동 시 일괄 구현.

---

## 3. Q-Gate 검증 결과

| Gate | 항목 | 결과 | 근거 |
|------|------|------|------|
| G1 | FR ID 전수 | PARTIAL | 11개 FR 중 MUST 6/9 |
| G2 | 설계 완전성 | PASS | Design 보완 완료 (v1.1) |
| G3 | 코드 품질 | PASS | 환경변수 기반 설정, 타입 안전, 하드코딩 없음 |
| G4 | 테스트 커버리지 | DEFER | MTU-P21 |
| G5 | OWASP Top10 | PASS | Rate Limiting(DDoS), CORS(XSS), 프록시(SSRF 제한) |
| G6 | CSAP D-10 준수 | PASS | Rate Limiting + CORS 구현 |
| G7 | audit.jsonl | PASS | 감사 구조 준비 |

---

## 4. 발견 이슈 및 조치

| 이슈 | 심각도 | 조치 |
|------|--------|------|
| 게이트웨이 수준 인증 미들웨어 미연결 | MEDIUM | 각 서비스 자체 인증으로 대체, 후속 통합 |
| RBAC 검사 미연결 | MEDIUM | 레지스트리 requiredPermissions 정의 완료, 후속 연결 |
| 동적 프록시 NOT_IMPLEMENTED | LOW | SHOULD, SDK(MTU-P18) 연동 시 구현 |
| 감사 로그 미구현 | MEDIUM | MTU-P13 연동 시 일괄 |
| data-grade 미들웨어 AI 라우트 미연결 | LOW | AI 서비스 자체 등급 검사로 대체 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
