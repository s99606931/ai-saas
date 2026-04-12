# SVC-AI-ADV-R196 Design — AI기반 테스트 데이터 자동 생성

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | QA 테스트 데이터 생성 자동화 |
| RISK | C/S 등급 스키마로 민감 데이터 유사 생성 위험 → 등록 단계 차단 |
| SCOPE | 구현 파일: `test-data-generator-ai.ts` |

## 클래스 설계

### `TestDataGeneratorAi`

| 메서드 | 설명 |
|--------|------|
| `registerSchema(spec)` | SchemaSpec 등록 (C/S 등급 차단) |
| `generate(schemaId, count)` | 레코드 배치 생성 |
| `getAuditLog()` | CSAP D-06 감사 로그 |

## 필드 타입 생성 규칙

| FieldType | 생성 값 예시 |
|-----------|------------|
| uuid | `00000000-0000-0000-0000-000000000000` |
| email | `user{i}@example.com` |
| phone | `010-{4자리}-{4자리}` |
| date | `2026-01-{01~28}` |
| boolean | `i % 2 === 0` |

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R196.1 | registerSchema | C/S 차단 | N2SF N-05 |
| FR-R196.2 | generate | 필드 타입별 생성 | D-12 |
| FR-R196.3 | generate | count 일치 | D-12 |
| FR-R196.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
