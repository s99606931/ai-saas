# SVC-AI-ADV-R173 Design — AI기반 API 스펙 자동 생성

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | API 문서 자동화, 감리 산출물 품질 향상 |
| WHO | API 개발팀, 감리 담당 |
| RISK | 보안 설정 누락된 스펙 생성 가능 |
| SUCCESS | OpenAPI 3.0 자동 생성 + RBAC 누락 경고 |
| SCOPE | 구현 파일: `api-spec-generator-ai.ts` |

## 클래스 설계

### `ApiSpecGeneratorAi`

| 메서드 | 설명 |
|--------|------|
| `generate(endpoints, title, version)` | OpenAPI 3.0 스펙 생성 |
| `validateSecurity(spec)` | 관리자 경로 RBAC 누락 검사 |
| `getDuplicates(endpoints)` | 중복 경로 탐지 |
| `getAuditLog()` | CSAP D-06 감사 로그 반환 |

## 보안 설계 (CSAP D-08)

- /admin 경로는 rbac 보안 필수
- 중복 경로 탐지로 API 명세 무결성 보장

## 추적성 매트릭스

| FR ID | 구현 메서드 | 테스트 케이스 | CSAP |
|-------|-----------|--------------|------|
| FR-R173.1 | generate | OpenAPI 스펙 구조 | D-12 |
| FR-R173.2 | validateSecurity | RBAC 누락 경고 | D-08 |
| FR-R173.3 | getDuplicates | 중복 경로 탐지 | D-12 |
| FR-R173.4 | generate | paths 구조화 | D-12 |
| FR-R173.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
