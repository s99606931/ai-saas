# SVC-EVENTSCHEMA-R48 Plan — 이벤트 스키마 레지스트리

| 항목 | 값 |
|------|-----|
| MTU | SVC-EVENTSCHEMA-R48 |
| 대상 | `platform/packages/event-schema-registry` |
| 복잡도 | MED |
| 작성일 | 2026-04-11 |

---

## Executive Summary

| 관점 | 현황 | 목표 |
|------|------|------|
| 기능 | event-bus는 임의 페이로드 전달, 스키마 강제 없음 | 이벤트 타입별 스키마 등록 + 발행 시 검증 |
| 품질 | 서비스 간 페이로드 변경 시 silent failure | 호환성 매트릭스 + semver 검증 |
| 보안 | 잘못된 페이로드로 다운스트림 충돌 | 스키마 위반 → publish 차단 (CSAP D-12) |
| 운영 | 이벤트 카탈로그 부재 | listEvents/getSchema API |

---

## Context Anchor

- **WHY**: 17개 마이크로서비스가 이벤트로 통신할 때 스키마 변경은 silent breakage를 유발. 등록된 스키마와 호환되는 페이로드만 발행하도록 보호가 필요.
- **WHO**: outbox, event-bus, 향후 Kafka/NATS adapter.
- **RISK**: 스키마 등록 누락 → 검증 우회. 과도한 strict 검증 → 마이그레이션 어려움.
- **SUCCESS**: 이벤트 타입별 JSON-Schema-like 검증 + semver 호환성 + 변경 이력.
- **SCOPE**: in-memory 레지스트리 + JSON Schema subset (object, string, number, boolean, array, required, enum) 검증. 외부 스키마 저장소는 제외.

---

## FR

| ID | 요구사항 | 수용 기준 |
|----|----------|----------|
| FR-ESR.1 | `register(eventType, version, schema)` 등록 | 동일 (type, version) 중복 시 예외 |
| FR-ESR.2 | semver 비교(`1.2.3`) | major 증가 시 breaking |
| FR-ESR.3 | `validate(eventType, version, payload)` 검증 결과 | 누락 필드 → 에러 메시지 + 경로 |
| FR-ESR.4 | 스키마 호환성 검사: 새 minor/patch는 backward compat 보장 | required 필드 추가 시 차단 |
| FR-ESR.5 | `latest(eventType)` 최신 버전 조회 | semver 정렬 |
| FR-ESR.6 | `listEvents()` 카탈로그 조회 | 정렬된 목록 |
| FR-ESR.7 | 검증 실패 시 `EventSchemaError` (path 포함) | 다중 에러 집계 |
| FR-ESR.8 | 미등록 이벤트 발행 시 strict 모드면 거부, lenient 모드면 통과 | 옵션 제어 |

---

## Q-Gate

- G1: 8/8 FR
- G2: Design + JSON Schema subset 명시
- G3: typecheck strict
- G4: 20개 이상 테스트
- G5: 입력 검증
- G6: D-12 시스템 개발 보안
- G7: audit.jsonl
