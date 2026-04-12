# SVC-AI-ADV-R172 Design — AI기반 코드 자동 생성

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 반복 보일러플레이트 제거, 개발 생산성 향상 |
| WHO | 개발팀 |
| RISK | 생성 코드 내 하드코딩 시크릿 포함 가능성 |
| SUCCESS | 템플릿 기반 코드 생성 + 보안 검사 자동화 |
| SCOPE | 구현 파일: `ai-code-generator.ts` |

## 클래스 설계

### `AiCodeGenerator`

| 메서드 | 설명 |
|--------|------|
| `registerSpec(spec)` | CodeSpec 등록 및 고유 ID 반환 |
| `generate(specId)` | 템플릿 기반 코드 생성 |
| `getHistory(specId)` | 생성 이력 조회 |
| `securityCheck(code)` | 하드코딩 시크릿/패스워드 탐지 |
| `getAuditLog()` | CSAP D-06 감사 로그 반환 |

## 보안 설계 (CSAP D-12)

- 보안 검사: `/sk-[A-Za-z0-9]{20,}/`, `/password\s*=/i` 패턴 탐지
- 감사 로그: 모든 코드 생성 이벤트 기록

## 추적성 매트릭스

| FR ID | 구현 메서드 | 테스트 케이스 | CSAP |
|-------|-----------|--------------|------|
| FR-R172.1 | registerSpec | 스펙 등록 ID | D-12 |
| FR-R172.2 | generate | TypeScript CRUD 생성 | D-12 |
| FR-R172.3 | getHistory | 이력 조회 | D-06 |
| FR-R172.4 | securityCheck | 시크릿 탐지 | D-09 |
| FR-R172.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
