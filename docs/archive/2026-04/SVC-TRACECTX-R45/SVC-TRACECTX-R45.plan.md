# SVC-TRACECTX-R45 Plan — 분산 추적 컨텍스트 헬퍼

| 항목 | 값 |
|------|-----|
| MTU ID | SVC-TRACECTX-R45 |
| 대상 | `platform/packages/trace-context` |
| 복잡도 | LOW-MED |
| 작성일 | 2026-04-11 |
| 의존 | observability (기존 OTel 초기화) |

---

## Executive Summary

| 관점 | 현황 | 목표 | 지표 |
|------|------|------|------|
| 기능 | OTel SDK 초기화만 존재, Span 편의 API 부재 | `withSpan`, `startSpan`, `getTraceContext` 헬퍼 제공 | 모든 서비스에서 1줄로 스팬 생성 |
| 품질 | 상관관계 ID 생성 중앙화 없음 | W3C traceparent 호환 ID 생성기 | 테스트 10개 이상 |
| 보안 | 추적 속성에 민감 데이터 포함 위험 | 속성 화이트리스트 + 마스킹 | CSAP D-06 연계 |
| 운영 | OTel 미설치 시 예외 | 시그널 fallback (OTel 없을 때도 동작) | 무중단 fallback |

---

## Context Anchor

- **WHY**: 마이크로서비스 17개에서 요청 상관관계 추적이 필요하나, OTel API 직접 사용은 장황하고 에러가 많음. 얇은 래퍼가 필요.
- **WHO**: 모든 `platform/services/*`의 HTTP 핸들러 및 백엔드 작업.
- **RISK**: OTel 패키지 미설치 환경에서 ReferenceError 발생, 사이드 이펙트로 요청 실패.
- **SUCCESS**: OTel 있으면 span 생성, 없으면 no-op. 상관관계 ID는 항상 생성. 속성 검증.
- **SCOPE**: traceparent 파싱/생성, withSpan 래퍼, 상관관계 헬퍼. OTel exporter 설정 제외 (observability 책임).

---

## FR 목록

| ID | 요구사항 | 수용 기준 |
|----|----------|----------|
| FR-TC.1 | W3C traceparent 헤더 파싱 (version-traceId-spanId-flags) | 잘못된 포맷은 undefined 반환 |
| FR-TC.2 | W3C traceparent 헤더 생성 | 생성 후 재파싱 가능 |
| FR-TC.3 | 16바이트 traceId / 8바이트 spanId 난수 생성 | 모두 소문자 hex |
| FR-TC.4 | `withSpan(name, fn)` 래퍼: 에러 시 span에 기록 후 rethrow | 에러 경로 테스트 |
| FR-TC.5 | OTel 패키지 미설치 시 no-op 구현으로 폴백 | try/catch + dynamic import |
| FR-TC.6 | Span 속성 화이트리스트 검증 (허용 키만 기록) | `password`, `token` 등 차단 |
| FR-TC.7 | 현재 컨텍스트의 traceId 조회 (`getCurrentTraceId`) | OTel 없을 때 fallback ID 반환 |
| FR-TC.8 | AsyncLocalStorage 기반 상관관계 ID 전파 | 중첩 비동기 흐름 검증 |

---

## Q-Gate 목표

- G1: 8/8 FR 매핑
- G2: Design에 모듈 구조 + 타입 정의 + 폴백 전략
- G3: typecheck strict 통과
- G4: 테스트 10개 이상 통과
- G5: 속성 화이트리스트(SQL/PII 차단)
- G6: CSAP D-06 분산 추적 보완
- G7: audit.jsonl 기록
