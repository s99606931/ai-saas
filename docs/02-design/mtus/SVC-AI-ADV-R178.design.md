# SVC-AI-ADV-R178 Design — AI기반 실시간 감사 보고서 생성

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | CSAP D-06 준수를 위한 실시간 감사 추적 및 자동 보고 |
| WHO | 감사팀, CSAP 심사 담당 |
| RISK | 감사 로그 누락 시 CSAP 인증 실패 |
| SUCCESS | 준수율 자동 산출 + 리스크 스코어 기반 보고서 |
| SCOPE | 구현 파일: `realtime-audit-reporter.ts` |

## 클래스 설계

### `RealtimeAuditReporter`

| 메서드 | 설명 |
|--------|------|
| `record(event)` | 감사 이벤트 append-only 기록 |
| `query(tenantId, from, to)` | 테넌트/기간별 조회 |
| `summarize(tenantId, from, to)` | 카테고리/결과별 요약 |
| `checkCompliance(tenantId, from, to)` | CSAP/N2SF 준수 검사 |
| `generateReport(tenantId, from, to)` | 리스크 스코어 보고서 |
| `getAuditLog()` | 내부 감사 로그 반환 |

## 준수 검사 항목

| 항목 | 기준 |
|------|------|
| CSAP D-06 | 이벤트 보존 기간 확인 |
| CSAP D-08 | 인증 실패 5회 미만 |
| N2SF N-05 | AI_API_CALL 차단율 확인 |

## 추적성 매트릭스

| FR ID | 구현 메서드 | 테스트 케이스 | CSAP |
|-------|-----------|--------------|------|
| FR-R178.1 | record | 이벤트 기록 총계 | D-06 |
| FR-R178.2 | query | 기간별 조회 | D-06 |
| FR-R178.3 | summarize | 카테고리/결과 요약 | D-06 |
| FR-R178.4 | checkCompliance | CSAP/N2SF 검사 | D-06 |
| FR-R178.5 | generateReport | 리스크 스코어 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
