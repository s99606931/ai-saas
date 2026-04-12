# SVC-PROBLEMJSON-R49 Plan — RFC 7807 Problem Details 빌더

| 항목 | 값 |
|------|-----|
| MTU | SVC-PROBLEMJSON-R49 |
| 대상 | `platform/packages/problem-details` |
| 복잡도 | LOW |
| 작성일 | 2026-04-11 |

## Executive Summary

| 관점 | 현황 | 목표 |
|------|------|------|
| 기능 | 각 서비스가 ad-hoc 에러 응답 객체 생성 | 표준 RFC 7807 빌더 + 16종 사전정의 |
| 품질 | 응답 포맷 분산 | 단일 진실 소스 + 18+ 테스트 |
| 보안 | 에러 메시지에 내부 정보 누출 위험 | sanitize 옵션 + 환경별 detail 제어 |
| 운영 | 클라이언트 디버깅 어려움 | traceId 주입 가능 |

## Context Anchor

- **WHY**: HTTP API 에러 응답 표준화는 클라이언트 통합성과 감리 추적성에 필수. RFC 7807은 `application/problem+json` 표준 정의.
- **WHO**: 모든 마이크로서비스 컨트롤러, api-gateway.
- **RISK**: detail 필드에 stack trace나 SQL 구문이 노출될 위험.
- **SUCCESS**: ProblemDetails 빌더 + 16종 표준 에러(400/401/403/404/409/422/429/500/503 등) + traceId 주입.
- **SCOPE**: 빌더 함수 + 표준 사전 + sanitize. 실제 HTTP 응답 직렬화는 호출측 책임.

## FR

| ID | 요구사항 | 수용 기준 |
|----|----------|----------|
| FR-PD.1 | `ProblemDetails` 인터페이스 (type, title, status, detail, instance) | 타입 정의 export |
| FR-PD.2 | `problem(opts)` 빌더: 필수 필드 검증 | status 누락 시 예외 |
| FR-PD.3 | 16종 표준 사전정의: badRequest, unauthorized, forbidden, notFound, conflict, unprocessable, tooManyRequests, internalError 등 | 각 함수 상태 코드 검증 |
| FR-PD.4 | `withTraceId(problem, id)` 추적 정보 주입 | extension 필드 확인 |
| FR-PD.5 | `withErrors(problem, fieldErrors[])` 필드 에러 첨부 | request-validator 호환 |
| FR-PD.6 | `sanitize(problem, env)` env=production 시 detail 제거 | 환경별 동작 |
| FR-PD.7 | extension 필드 (RFC 7807 §3.2) 자유 추가 가능 | 추가 키 지원 |
| FR-PD.8 | type URI 기본값: `https://problems.public-saas.kr/{slug}` | URI 형식 검증 |

## Q-Gate
G1(8/8) G2 G3 G4(18+) G5(detail sanitize) G6(D-12) G7
